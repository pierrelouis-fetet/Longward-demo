partieDeTests('tests/33-scpi.tests.js');
/* ------------------------------------------------------------------
   Une SCPI se tient en parts, chez sa societe de gestion, vaut ses parts au
   prix que celle-ci publie, se rappelle une fois l'an et se cede. Montants
   fictifs.
   ------------------------------------------------------------------ */
suite('SCPI en parts', () => {
  const DATE = '2026-06-15';
  /* La phrase vit dans app.js, que le harnais ne charge pas : elle se relit a
     la source. */
  const AIDE_VALEUR_PARTS_TEST = ((lireSource('assets/app.js') || '').match(/const AIDE_VALEUR_PARTS = '([^']+)';/) || [])[1];
  const ilYA = jours => isoDeDate(new Date(Date.now() - jours * 864e5));

  /* Une SCPI de 50 parts, 200 la part au prix publie, 220 payees, financee a
     credit, avec sa distribution, ses frais et la mensualite de son credit au
     budget. */
  const poser = (modifier) => Fixture.poser(s => {
    s.etabs.push({ id: 'e_sg', nom: 'Société de gestion', notes: '',
                   dettes: [{ id: 'd_scpi', libelle: 'Prêt SCPI', montant: 6000, note: '', bienId: 'c_scpi' }] });
    s.comptes.push({ id: 'c_scpi', etabId: 'e_sg', type: 'scpi', statut: 'ouvert', ouvertLe: '2022-01-01',
                     numero: '', notes: '', libelle: 'SCPI test', court: 'SCPI', alloc: '', cash: [],
                     lignes: [{ id: 'l_scpi', classe: 'immobilier', libelle: 'SCPI test', valeur: 10000,
                                prixDeRevient: 11000, parts: 50, quantite: 1, dateAcquisition: '2022-01-01',
                                estimeLe: ilYA(30) }] });
    s.budget.income.push({ label: 'Distribution', amount: 40, bienId: 'c_scpi' });
    s.budget.fixedCharges.push({ label: 'Mensualité SCPI', amount: 100, creditId: 'd_scpi', bienId: 'c_scpi' },
                               { label: 'Frais', amount: 5, bienId: 'c_scpi' });
    if (modifier) modifier(s);
  });
  const ceder = extra => cederPlacement({ compteId: 'c_scpi', index: 0, parts: 50, produit: 10000,
    cashAccount: 'c_courant', cashPart: 'courant', date: DATE, ...extra });
  const photoEtat = () => JSON.stringify({ comptes: Store.state.comptes, etabs: Store.state.etabs,
                                           budget: Store.state.budget, sales: Store.state.sales });

  test('le type : des parts, un prix publié, une société de gestion', () => {
    const t = typeCompte('scpi');
    vrai(t.parts && valeurAuPrixDeRetrait(t) && compteEstUnPlacement(t), 'une SCPI se compte en parts, et le compte est son placement');
    vrai(!t.vl && !estValeurEstimee(t) && !estActifTerminal(t), 'ni une VL, ni une estimation, ni un actif terminal');
    eq(familleDuType('scpi'), 'societe', 'elle se tient chez sa société de gestion');
    for (const id of ['immo', 'pe', 'fondsNonCote', 'av', 'cto'])
      vrai(!valeurAuPrixDeRetrait(typeCompte(id)), `${id} n’a pas de prix de retrait`);
    poser();
    const ids = etablissementsProposables('scpi').map(x => x.etab.id);
    vrai(!ids.includes('e_bien'), 'le contenant d’un appartement ne lui est plus proposé');
    vrai(ids.includes('e_sg') && ids.includes('e_pe'), 'une société ou une plateforme, si');
  });

  test('sa valeur date d’une vérification, et se rappelle à un an', () => {
    poser(s => { s.comptes.find(c => c.id === 'c_scpi').lignes[0].estimeLe = ilYA(500); });
    const c = compteById('c_scpi');
    eq(JSON.stringify(datesDuCompte(c)), JSON.stringify([{ genre: 'retrait', date: ilYA(500) }]), 'l’en-tête dit sa date');
    const r = valeursARevoir().filter(x => x.compteId === 'c_scpi' && x.genre === 'estimation');
    eq(r.length, 1, 'vieille d’un an et demi, elle est à revoir');
    vrai(r[0].releve && !r[0].publiee, 'dite « valeur au »');
    eq(JSON.stringify(r[0].ouvre), JSON.stringify({ action: 'editer-placement', id: 'c_scpi', i: 0 }), 'et elle ouvre sa fenêtre');
    poser();
    eq(valeursARevoir().filter(x => x.compteId === 'c_scpi' && x.genre === 'estimation').length, 0, 'vérifiée il y a un mois : rien à revoir');
    poser(s => { delete s.comptes.find(c => c.id === 'c_scpi').lignes[0].estimeLe; });
    eq(valeursARevoir().filter(x => x.compteId === 'c_scpi' && x.genre === 'estimation').length, 1, 'sans date, à revoir');
    const i = COMPTES().findIndex(x => x.id === 'c_scpi');
    eq(dateQuiSuit(`comptes.${i}.lignes.0.valeur`).genre, 'estimation', 'taper une nouvelle valeur la date du jour');
    eq(dateApresSaisie({ avant: 1, apres: 1, dateAvant: '2025-01-01', dateSaisie: '2025-01-01', genre: 'estimation', jour: DATE }),
      DATE, 'et « Enregistrer » la vérifie aujourd’hui, comme une estimation');
  });

  test('son nom vit sur le compte et sa ligne, jamais sur sa société', () => {
    poser();
    nommerPlacementImmo(compteById('c_scpi'), 'SCPI renommée', 0);
    eq(compteById('c_scpi').libelle, 'SCPI renommée', 'le compte');
    eq(compteById('c_scpi').lignes[0].libelle, 'SCPI renommée', 'et sa ligne');
    eq(etabById('e_sg').nom, 'Société de gestion', 'la société garde son nom');
    poser(s => { s.comptes.find(c => c.id === 'c_scpi').lignes.push({ id: 'l_2', classe: 'immobilier', libelle: 'Seconde', valeur: 1000 }); });
    nommerPlacementImmo(compteById('c_scpi'), 'Seconde renommée', 1);
    eq(compteById('c_scpi').lignes.map(l => l.libelle).join(','), 'SCPI test,Seconde renommée', 'à deux lignes, la seule visée');
    eq(compteById('c_scpi').libelle, 'SCPI test', 'et le compte garde le sien');
    poser();
    poser(s => { s.comptes.find(c => c.id === 'c_scpi').cash = [{ montant: 0, affectation: 'investir' }]; });
    nommerPlacementImmo(compteById('c_scpi'), 'Avec espèces', 0);
    eq(compteById('c_scpi').lignes[0].libelle, 'Avec espèces', 'avec une part d’espèces, la ligne change');
    eq(compteById('c_scpi').libelle, 'SCPI test', 'et le compte garde son nom, comme dans les deux fenêtres');
    poser();
    nommerPlacementImmo(compteById('c_immo'), 'Studio renommé');
    eq(compteById('c_immo').lignes[0].libelle, 'Studio renommé', 'un bien en direct renomme ses lots');
    eq(etabById('e_bien').nom, 'Studio renommé', 'et son contenant, où il est seul');
  });

  test('céder une partie des parts : le prix par part ne bouge pas', () => {
    poser();
    const r = ceder({ parts: 20, produit: 4000 });
    vrai(r && !r.erreur, r && r.erreur);
    const l = compteById('c_scpi').lignes[0];
    eq(l.parts, 30, 'il reste trente parts');
    pres(l.valeur, 6000, 'au même prix de 200');
    pres(l.prixDeRevient, 6600, 'et au même coût de 220');
    eq(compteById('c_scpi').statut, 'ouvert', 'le compte reste ouvert');
    pres(num(compteById('c_courant').cash[0].montant), 3000 + 4000, 'le produit arrive sur le compte courant');
  });

  test('49,999 parts sur 50 laissent une ligne', () => {
    poser();
    const r = ceder({ parts: 49.999, produit: 9999.8 });
    vrai(r && !r.erreur && !r.totale, 'la cession n’est pas totale');
    const l = compteById('c_scpi').lignes[0];
    vrai(l && Math.abs(l.parts - 0.001) < 1e-9, 'il reste un millième de part');
    pres(l.valeur, 0.2, 'et sa valeur');
    eq(compteById('c_scpi').statut, 'ouvert', 'le compte reste ouvert');
  });

  test('un reliquat que la précision ne représente pas rend la cession totale, sortie comprise', () => {
    poser(s => { Object.assign(s.comptes.find(c => c.id === 'c_scpi').lignes[0], { parts: 0.001, valeur: 10000 }); });
    const a = apercuCession(compteById('c_scpi').lignes[0], typeCompte('scpi'), { parts: 0.000999996, produit: 10000 });
    vrai(a.totale, 'il ne reste rien qu’une quantité puisse porter');
    eq(a.fraction, 1, 'la fraction est entière');
    pres(a.sortie, 10000, 'et c’est la ligne entière qui sort du patrimoine');
  });

  test('une ligne cédée en entier sur un compte qui en garde une autre ne touche pas aux flux', () => {
    poser(s => { s.comptes.find(c => c.id === 'c_scpi').lignes.push({ id: 'l_2', classe: 'immobilier', libelle: 'Seconde',
                                                                        valeur: 1000, parts: 5 }); });
    const r = ceder();
    vrai(r && !r.erreur && r.totale, 'la première ligne part en entier');
    eq(compteById('c_scpi').statut, 'ouvert', 'le compte garde sa seconde ligne');
    vrai(B().income.some(x => x.bienId === 'c_scpi') && B().fixedCharges.some(x => x.label === 'Frais'),
      'ses flux restent, rattachés');
    vrai(!Store.state.sales[0].fluxRetires && !Store.state.sales[0].fluxDelies, 'et la cession n’en retient aucun');
  });

  test('céder tout archive le compte, retire ses flux, garde son crédit, et s’annule', () => {
    poser();
    const avant = photoEtat();
    const r = ceder();
    vrai(r && !r.erreur, r && r.erreur);
    const c = compteById('c_scpi');
    eq(c.statut, 'archive', 'le compte s’archive');
    vrai(!B().income.some(x => x.bienId === 'c_scpi') && !B().fixedCharges.some(x => x.label === 'Frais'),
      'la distribution et les frais quittent le budget');
    const m = B().fixedCharges.find(x => x.creditId === 'd_scpi');
    vrai(m && m.bienId === 'c_scpi', 'la mensualité du crédit reste, liée à son crédit');
    eq(etabById('e_sg').dettes.length, 1, 'et le crédit reste à rembourser');
    vrai(!!Store.state.sales[0].photo, 'la cession garde la photo du compte');
    eq(verifierAnnulation(0), null, 'elle s’annule');
    annulerVente(0);
    eq(photoEtat(), avant, 'tout revient au JSON près');
  });

  test('céder tout sans retirer les flux les détache, et l’annulation les rattache', () => {
    poser();
    const avant = photoEtat();
    ceder({ retirerFlux: false });
    const dist = B().income.find(x => x.label === 'Distribution');
    vrai(dist && !dist.bienId, 'la distribution reste au budget, détachée');
    vrai(B().fixedCharges.find(x => x.creditId === 'd_scpi').bienId === 'c_scpi', 'la mensualité, elle, reste liée');
    annulerVente(0);
    eq(photoEtat(), avant, 'et l’annulation rattache la distribution et les frais');
  });

  test('l’annulation refuse un compte restauré, renommé, ou un flux revenu', () => {
    poser();
    ceder();
    compteById('c_scpi').statut = 'ouvert';
    vrai(/a changé depuis la cession/.test(verifierAnnulation(0)), 'restauré à la main');
    poser();
    ceder();
    compteById('c_scpi').libelle = 'Autre nom';
    vrai(/a changé depuis la cession/.test(verifierAnnulation(0)), 'renommé depuis');
    poser();
    ceder();
    B().income.push({ label: 'Distribution', amount: 40, bienId: 'c_scpi' });
    vrai(/de nouveau au budget/.test(verifierAnnulation(0)), 'une distribution remise au budget');
    const fige = photoEtat();
    vrai(!!annulerVente(0).erreur, 'l’annulation est refusée');
    eq(photoEtat(), fige, 'sans rien toucher');
  });

  test('une cession échouée après ses premières écritures ne laisse rien', () => {
    poser();
    const avant = photoEtat();
    const cash = num(compteById('c_courant').cash[0].montant);
    const orig = photoCompteCede;
    try {
      globalThis.photoCompteCede = () => { throw new Error('échec simulé'); };
      const r = ceder();
      vrai(r && r.erreur, 'la cession rend une erreur');
    } finally { globalThis.photoCompteCede = orig; }
    eq(photoEtat(), avant, 'comptes, budget et journal reviennent au JSON près');
    pres(num(compteById('c_courant').cash[0].montant), cash, 'et le cash crédité avant l’échec repart');
    const avant2 = JSON.stringify(Store.state.comptes);
    const t = enTransaction(() => { Store.state.comptes[0].libelle = 'modifié'; throw new Error('boum'); });
    vrai(!t.ok, 'une transaction qui lève échoue');
    eq(JSON.stringify(Store.state.comptes), avant2, 'et rend l’état d’avant');
  });

  test('une cession d’un placement sans photo garde ses gardes d’avant', () => {
    poser();
    const r = cederPlacement({ compteId: 'c_pe', index: 0, produit: 2500, cashAccount: 'c_courant',
                               cashPart: 'courant', date: DATE });
    vrai(r && !r.erreur, r && r.erreur);
    vrai(!Store.state.sales[0].photo, 'un financement participatif ne prend pas de photo');
    eq(compteById('c_pe').statut, 'archive', 'et s’archive comme avant');
    eq(verifierAnnulation(0), null, 'son annulation reste possible');
  });

  test('ce que dit une SCPI se traduit', () => {
    for (const k of ['Valeur des parts ({dev})', 'Valeur retenue par part ({dev})', 'Coût moyen payé par part ({dev})',
                     'Tes parts et leur valeur', 'Nom de la SCPI', 'Parts et prix de la part', 'Nom du placement',
                     'Indique ton nombre de parts.', 'Retirer ses distributions et frais du budget',
                     'Son crédit reste à rembourser : il compte dans ton patrimoine net tant que tu ne l’as pas soldé.',
                     'Le placement a changé depuis la cession : elle ne peut plus s’annuler.', AIDE_VALEUR_PARTS_TEST])
      vrai(!!I18N.en[k], `« ${k.slice(0, 40)} » a sa traduction`);
  });
});

finDePartieDeTests('tests/33-scpi.tests.js');
