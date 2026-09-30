partieDeTests('tests/31-vente-bien.tests.js');
/* ------------------------------------------------------------------
   Vendre un bien detenu en direct : le prix de chaque lot, les credits
   soldes, les frais de sortie du credit, le reste sur un compte, et le bien
   archive, dans une seule transaction qui s'annule en entier. Montants
   fictifs.
   ------------------------------------------------------------------ */
suite('Vente d’un bien', () => {
  const app = () => (lireSource('assets/app.js') || '').replace(/\/\*[\s\S]*?\*\//g, '');
  const DATE = '2026-06-15';

  /* Un appartement detenu a moitie, 300 000 pour le bien entier, un credit de
     100 000 qui a sa charge au budget, un loyer et une taxe fonciere. Le cout
     complet du bien entier fait 280 000 : 140 000 pour la moitie. */
  const poser = (modifier) => Fixture.poser(s => {
    const c = s.comptes.find(x => x.id === 'c_immo');
    c.libelle = 'Appartement'; c.court = 'Appartement';
    c.lignes = [{ id: 'l_appart', classe: 'immobilier', libelle: 'Appartement', valeur: 300000,
                  prixAchat: 250000, fraisAcquisition: 20000, travauxInitiaux: 10000, part: 50,
                  quantite: 1, dateAcquisition: '' }];
    s.etabs.find(e => e.id === 'e_bien').dettes = [
      { id: 'd_pret', libelle: 'Prêt immobilier', montant: 100000, note: '', bienId: 'c_immo', mensualite: 800 }];
    s.budget.fixedCharges.push(
      { label: 'Mensualité', amount: 800, creditId: 'd_pret', bienId: 'c_immo' },
      { label: 'Taxe foncière', amount: 90, bienId: 'c_immo' });
    s.budget.income.push({ label: 'Loyer', amount: 1200, bienId: 'c_immo' });
    if (modifier) modifier(s);
  });
  const saisie = (extra = {}) => ({
    compteId: 'c_immo', prix: { l_appart: 320000 }, remboursements: { d_pret: 100000 }, frais: 1500,
    date: DATE, cashAccount: 'c_courant', cashPart: 'courant', retirerFlux: true, ...extra,
  });
  const cashCourant = () => num(compteById('c_courant').cash[0].montant);
  const photoEtat = () => JSON.stringify({ comptes: Store.state.comptes, etabs: Store.state.etabs,
                                           budget: Store.state.budget, sales: Store.state.sales });

  test('le prix solde le crédit et ses frais, le reste arrive sur le compte, le bien s’archive', () => {
    poser();
    const netAvant = patrimoine().net;
    const a = apercuVenteBien(compteById('c_immo'), { prix: { l_appart: 320000 },
                                                      remboursements: { d_pret: 100000 }, frais: 1500 });
    pres(a.produit, 160000, 'ta part du prix : la moitié de 320 000');
    pres(a.sortie, 150000, 'la valeur détenue qui sort : la moitié de 300 000');
    pres(a.investi, 140000, 'le coût de ta part');
    pres(a.realised, 20000, 'la plus-value brute, sans les frais du crédit');
    pres(a.encaisse, 58500, '160 000 − 100 000 − 1 500');
    pres(a.effetNet, 8500, '58 500 encaissés − 150 000 sortis + 100 000 de dette retirée');

    const r = vendreBien(saisie());
    vrai(!r.erreur, r.erreur);
    pres(patrimoine().net - netAvant, 8500, 'le net bouge exactement de l’effet annoncé');
    pres(cashCourant(), 3000 + 58500, 'l’encaissé arrive sur la part désignée');
    const c = compteById('c_immo');
    eq(c.statut, 'archive', 'le bien s’archive');
    eq(c.clotureLe, DATE, 'à la date de la vente');
    eq(c.archiveMotif, 'sortie', 'comme un bien sorti du patrimoine');
    eq(etabById('e_bien').dettes.length, 0, 'le crédit est soldé');
    vrai(!B().fixedCharges.some(x => x.creditId === 'd_pret'), 'sa charge part avec lui');
    vrai(!B().fixedCharges.some(x => x.bienId === 'c_immo') && !B().income.some(x => x.bienId === 'c_immo'),
      'les loyers et charges du bien quittent le budget quand on le demande');
    const v = Store.state.sales[0];
    eq(v.typeActif, 'bien', 'la vente se range au journal comme un bien');
    eq(c.venduPar, v.id, 'le compte garde la vente qui l’a archivé');
    eq(v.perimetre, 'interne', 'l’encaissé est resté dans le patrimoine suivi');
    pres(v.gross, 160000, 'le journal dit ta part du prix');
    pres(v.encaisse, 58500, 'et ce qui est arrivé');
    pres(v.rembourse, 100000, 'ce que le crédit a pris');
    pres(v.effetNet, 8500, 'et l’effet sur le net');
    vrai(resultatVente(v).fiable, 'le résultat est calculable');
    pres(v.realised, 20000, 'et vaut 20 000');
  });

  test('l’export et les totaux disent le prix et l’encaissé, chacun dans sa colonne', () => {
    poser();
    vendreBien(saisie());
    const st = statsDesVentes(Store.state.sales);
    pres(st.grossFiables, 160000, 'le produit de la vente : ta part du prix');
    pres(st.encaisseFiables, 58500, 'l’encaissé net : ce qui reste après le crédit et ses frais');
    pres(encaisseNetVente({ gross: 1200 }), 1200, 'une vente de titres encaisse son produit');
    const exp = app().slice(app().indexOf('function sheetSales()'), app().indexOf('function sheetExpenses()'));
    for (const h of ['Prix unitaire', 'Prix de revient unitaire', 'Produit de la vente', 'Encaissé net', 'Coût'])
      vrai(exp.includes(`h: '${h}'`), `la colonne « ${h} »`);
    vrai(!exp.includes('Coût des titres'), 'le coût ne parle plus seulement de titres');
    vrai(/round2\(encaisseNetVente\(v\)\)/.test(exp) && /round2\(st\.encaisseFiables\)/.test(exp),
      'la ligne et le total de l’encaissé net');
    vrai(/v\.typeActif === 'bien' \? null : num\(v\.qty\)/.test(exp), 'un bien n’a ni quantité ni prix unitaire');
  });

  test('l’annulation rend l’état au centime : compte, crédit, charges, loyers, cash', () => {
    poser();
    const avant = photoEtat(), netAvant = patrimoine().net;
    vendreBien(saisie());
    eq(verifierAnnulation(0), null, 'la vente s’annule');
    const r = annulerVente(0);
    vrai(r && !r.erreur, r && r.erreur);
    eq(photoEtat(), avant, 'tout revient tel quel, au même rang');
    pres(patrimoine().net, netAvant, 'et le net aussi');
  });

  test('une part d’espèces née de la vente repart avec son annulation', () => {
    poser();
    const avant = photoEtat();
    eq(partieSuggeree('c_cto', { credit: true }), 'investir+', 'le compte-titres n’a pas encore de part');
    const r = vendreBien(saisie({ cashAccount: 'c_cto', cashPart: 'investir+' }));
    vrai(!r.erreur, r.erreur);
    pres(num(compteById('c_cto').cash[0].montant), 58500, 'la vente la crée et la crédite');
    annulerVente(0);
    eq(compteById('c_cto').cash.length, 0, 'l’annulation la retire, vide');
    eq(photoEtat(), avant, 'et l’état revient au JSON près');
  });

  test('des flux laissés au budget se détachent, puis se rattachent à l’annulation', () => {
    poser();
    const avant = photoEtat();
    vendreBien(saisie({ retirerFlux: false }));
    const loyer = B().income.find(x => x.label === 'Loyer');
    vrai(loyer && !loyer.bienId, 'le loyer reste au budget, sans lien vers un compte archivé');
    vrai(B().fixedCharges.some(x => x.label === 'Taxe foncière' && !x.bienId), 'la taxe aussi');
    vrai(!B().fixedCharges.some(x => x.creditId === 'd_pret'), 'la mensualité part avec son crédit');
    annulerVente(0);
    eq(photoEtat(), avant, 'l’annulation les rattache au bien');
  });

  test('un flux laissé au budget se retrouve par son rang, pas par son contenu', () => {
    /* Un loyer identique, sans lien, AVANT celui du bien : apres la vente les
       deux lignes se ressemblent, et seule la seconde doit se rattacher. */
    poser(s => { s.budget.income.unshift({ label: 'Loyer', amount: 1200 }); });
    const avant = photoEtat();
    vendreBien(saisie({ retirerFlux: false }));
    eq(B().income.filter(x => x.label === 'Loyer' && !x.bienId).length, 2, 'deux loyers identiques, aucun lié');
    eq(verifierAnnulation(0), null, 'la vente s’annule');
    annulerVente(0);
    eq(photoEtat(), avant, 'c’est le loyer du bien qui se rattache, à son rang');
    poser();
    vendreBien(saisie({ retirerFlux: false }));
    B().income.find(x => x.label === 'Loyer').amount = 1300;
    vrai(/a changé depuis la vente/.test(verifierAnnulation(0)), 'un loyer modifié depuis : refus');
    const fige = photoEtat();
    vrai(!!annulerVente(0).erreur, 'et rien ne s’écrit');
    eq(photoEtat(), fige, 'rien du tout');
  });

  test('un flux retiré ne revient pas en double', () => {
    poser();
    vendreBien(saisie());
    B().fixedCharges.push({ label: 'Mensualité', amount: 800, creditId: 'd_pret' });
    vrai(/de nouveau au budget/.test(verifierAnnulation(0)), 'une charge du même crédit remise au budget : refus');
    poser();
    vendreBien(saisie());
    B().income.push({ label: 'Loyer', amount: 1200, bienId: 'c_immo' });
    vrai(/de nouveau au budget/.test(verifierAnnulation(0)), 'le même loyer remis au budget : refus');
  });

  test('les sommes écrites au journal restent dans les bornes', () => {
    poser(s => {
      const c = s.comptes.find(x => x.id === 'c_immo');
      c.lignes = [{ id: 'l_a', classe: 'immobilier', libelle: 'A', valeur: 900e9, quantite: 1 },
                  { id: 'l_b', classe: 'immobilier', libelle: 'B', valeur: 900e9, quantite: 1 }];
    });
    const r = verifierVenteBien(saisie({ prix: { l_a: 900e9, l_b: 900e9 }, cashAccount: '', cashPart: '' }));
    vrai(/dépassent ce qu’un montant peut porter/.test(r), 'deux prix valides, une somme au-delà du plafond : refus');
  });

  test('« Modifier la vente » ne montre pas un résultat inconnu comme un zéro', () => {
    const a = app();
    const ed = a.slice(a.indexOf("async 'edit-sale'(btn)"), a.indexOf("async 'edit-sale'(btn)") + 2500);
    vrai(/resultatVente\(v\)\.fiable \? fmtSigned\(v\.realised\) : trad\('non calculable'\)/.test(ed),
      'sans coût, la fenêtre dit « non calculable »');
    vrai(!/, \$\{fmtSigned\(v\.realised\)\}`/.test(ed), 'et plus un +0 €');
  });

  test('deux lots à quotes-parts différentes : chacun son prix, chacun sa part', () => {
    poser(s => {
      s.comptes.find(x => x.id === 'c_immo').lignes.push({ id: 'l_parking', classe: 'immobilier',
        libelle: 'Parking', valeur: 20000, prixAchat: 15000, fraisAcquisition: 1000, travauxInitiaux: 0,
        quantite: 1, dateAcquisition: '' });
    });
    const a = apercuVenteBien(compteById('c_immo'), { prix: { l_appart: 320000, l_parking: 25000 },
                                                      remboursements: { d_pret: 100000 }, frais: 0 });
    pres(a.produit, 160000 + 25000, 'la moitié de l’appartement, le parking entier');
    pres(a.sortie, 150000 + 20000, 'et la valeur détenue de chacun');
    pres(a.investi, 140000 + 16000, 'le coût de chaque part');
    vrai(/Indique le prix de chaque lot/.test(verifierVenteBien(saisie())), 'un lot sans prix est refusé');
    vrai(!vendreBien(saisie({ prix: { l_appart: 320000, l_parking: 25000 } })).erreur, 'avec les deux, la vente passe');
  });

  test('un coût ancien se lit, un lot sans coût rend le résultat inconnu', () => {
    Fixture.poser();
    const c = compteById('c_immo');
    const a = apercuVenteBien(c, { prix: { l_immo: 130000 }, remboursements: { d_pret: 40000 }, frais: 0 });
    pres(a.investi, 110000, 'le prix de revient d’avant le détail compte');
    pres(a.realised, 20000, 'et le résultat se calcule');
    Fixture.poser(s => { const l = s.comptes.find(x => x.id === 'c_immo').lignes[0]; l.prixDeRevient = 0; });
    const b = apercuVenteBien(compteById('c_immo'), { prix: { l_immo: 130000 }, remboursements: { d_pret: 40000 } });
    eq(b.investi, null, 'sans coût, rien n’est inventé');
    eq(b.realised, null, 'ni résultat');
    const r = vendreBien({ compteId: 'c_immo', prix: { l_immo: 130000 }, remboursements: { d_pret: 40000 },
                           date: DATE, cashAccount: 'c_courant', cashPart: 'courant' });
    vrai(!r.erreur, r.erreur);
    eq(resultatVente(Store.state.sales[0]).raison, 'prixDeRevient', 'le journal dit pourquoi il se tait');
  });

  test('l’aperçu dit l’effet selon le sens réel du cash', () => {
    /* La moitie d'un bien, un credit de 100 000. Chaque cas pose la valeur du
       bien entier et son prix. */
    const dit = (valeur, prix, credite) => {
      poser(s => { s.comptes.find(x => x.id === 'c_immo').lignes[0].valeur = valeur; });
      const a = apercuVenteBien(compteById('c_immo'), { prix: { l_appart: prix },
                                                        remboursements: { d_pret: 100000 }, frais: 0, credite });
      return { a, p: phraseEffetVenteBien(a, credite) };
    };
    let x = dit(100000, 100000, true);
    pres(x.a.encaisse, -50000, 'ta part du prix, 50 000, ne couvre pas le crédit : le compte paie 50 000');
    pres(x.a.effetNet, 0, 'sans rien changer au net');
    vrai(/le prix et ton compte soldent ses crédits/.test(x.p), 'la phrase dit le débit, pas un passage au cash');
    x = dit(200000, 200000, false);
    pres(x.a.encaisse, 0, 'un prix qui solde juste le crédit');
    vrai(/le prix solde exactement ses crédits/.test(x.p), 'et la phrase le dit');
    x = dit(100000, 300000, false);
    vrai(/ne va sur aucun compte suivi/.test(x.p) && /\+50\s000/.test(x.p), 'un reste hors de Longward, avec son effet');
    x = dit(200000, 300000, true);
    vrai(/Effet sur ton patrimoine : \+50\s000/.test(x.p), 'un reste versé : l’écart avec la valeur connue');
    poser(s => { s.etabs.find(e => e.id === 'e_bien').dettes = []; });
    const b = apercuVenteBien(compteById('c_immo'), { prix: { l_appart: 300000 }, credite: true });
    vrai(/la valeur du bien passe au cash/.test(phraseEffetVenteBien(b, true)), 'sans crédit ni écart');
  });

  test('seul un bien vide de tout le reste se vend ainsi', () => {
    poser(s => { s.comptes.find(x => x.id === 'c_immo').cash = [{ montant: 50, affectation: 'investir' }]; });
    vrai(/porte des espèces/.test(verifierVenteBien(saisie())), 'des espèces sur le bien : refus');
    poser(s => { s.comptes.find(x => x.id === 'c_immo').lignes.push({ id: 'l_x', classe: 'nonCote', libelle: 'Parts', valeur: 10 }); });
    vrai(/n’est pas de l’immobilier/.test(verifierVenteBien(saisie())), 'une ligne d’une autre classe : refus');
    poser();
    vrai(/Seul un bien immobilier/.test(verifierVenteBien(saisie({ compteId: 'c_pe' }))), 'un placement ne se vend pas ici');
    vrai(/son propre prix/.test(verifierVenteBien(saisie({ cashAccount: 'c_immo', cashPart: 'investir' }))),
      'le bien ne reçoit pas son propre prix');
    vrai(/sur chaque crédit/.test(verifierVenteBien(saisie({ remboursements: {} }))), 'un crédit oublié : refus');
    vrai(/sur chaque crédit/.test(verifierVenteBien(saisie({ remboursements: { d_pret: 100000, d_autre: 1 } }))),
      'un crédit inconnu : refus');
    vrai(/ne disparaît pas sans paiement/.test(verifierVenteBien(saisie({ remboursements: { d_pret: 0 } }))),
      'un crédit soldé de zéro : refus');
    vrai(/date de la vente/.test(verifierVenteBien(saisie({ date: '' }))), 'sans date : refus');
    const avant = photoEtat();
    vrai(!!vendreBien(saisie({ remboursements: { d_pret: 0 } })).erreur, 'le modèle refuse aussi');
    eq(photoEtat(), avant, 'et rien n’a bougé');
  });

  test('sans compte désigné, ce qui reste sort du patrimoine suivi', () => {
    poser();
    const netAvant = patrimoine().net;
    const r = vendreBien(saisie({ cashAccount: '', cashPart: '' }));
    vrai(!r.erreur, r.erreur);
    pres(cashCourant(), 3000, 'aucun compte n’est crédité');
    pres(patrimoine().net - netAvant, -150000 + 100000, 'la valeur sort, la dette aussi');
    const v = Store.state.sales[0];
    eq(v.perimetre, 'sortie', 'la vente est une sortie');
    const ev = variationPatrimoine({ date: '2026-01-01', net: 0 }, { date: '2026-12-31', net: 0 }).explicitEvents;
    eq(ev.length, 1, 'la variation du patrimoine la montre');
    pres(ev[0].montant, -50000, 'pour son effet sur le net, pas pour le prix');
  });

  test('un prix qui solde juste les crédits reste dans le patrimoine suivi', () => {
    poser();
    const r = vendreBien(saisie({ prix: { l_appart: 203000 }, cashAccount: '', cashPart: '' }));
    vrai(!r.erreur, r.erreur);
    pres(r.encaisse, 0, '101 500 − 100 000 − 1 500');
    eq(Store.state.sales[0].perimetre, 'interne', 'rien n’est sorti : le prix a soldé la dette');
    eq(variationPatrimoine({ date: '2026-01-01', net: 0 }, { date: '2026-12-31', net: 0 }).explicitEvents.length, 0,
      'aucune sortie à expliquer');
  });

  test('un prix qui ne couvre pas les crédits se paie depuis un compte qui le peut', () => {
    const prix = { l_appart: 150000 };           // 75 000 pour ta part, 100 000 de crédit
    poser();
    vrai(/désigne le compte qui paie la différence/.test(verifierVenteBien(saisie({ prix, cashAccount: '', cashPart: '' }))),
      'sans compte : refus');
    vrai(/Il n’y a que/.test(verifierVenteBien(saisie({ prix }))), 'un compte qui ne couvre pas : refus');
    poser(s => { s.comptes.find(x => x.id === 'c_courant').cash[0].montant = 30000; });
    const netAvant = patrimoine().net;
    const r = vendreBien(saisie({ prix }));
    vrai(!r.erreur, r.erreur);
    pres(r.encaisse, -26500, '75 000 − 100 000 − 1 500');
    pres(cashCourant(), 3500, 'la différence est débitée');
    pres(patrimoine().net - netAvant, r.effetNet, 'le net suit l’effet annoncé');
    annulerVente(0);
    pres(cashCourant(), 30000, 'l’annulation la rend');
  });

  test('l’annulation refuse un bien restauré, modifié ou dont le crédit est revenu', () => {
    poser();
    vendreBien(saisie());
    const c = compteById('c_immo');
    c.statut = 'ouvert'; delete c.venduPar;
    vrai(/a changé depuis la vente/.test(verifierAnnulation(0)), 'restauré à la main');
    poser();
    vendreBien(saisie());
    compteById('c_immo').lignes[0].valeur = 310000;
    vrai(/a changé depuis la vente/.test(verifierAnnulation(0)), 'modifié depuis la vente');
    poser();
    vendreBien(saisie());
    etabById('e_bien').dettes.push({ id: 'd_pret', libelle: 'Prêt immobilier', montant: 5000 });
    vrai(/existe de nouveau/.test(verifierAnnulation(0)), 'un crédit du même identifiant recréé');
    const avant = photoEtat();
    vrai(!!annulerVente(0).erreur, 'l’annulation est refusée');
    eq(photoEtat(), avant, 'sans rien toucher');
  });

  test('deux ventes du même instant ont deux identifiants', () => {
    poser();
    const maintenant = Date.now;
    try {
      Date.now = () => 1234;
      Store.state.sales = [{ id: 's1234' }, { id: 's1234-2' }];
      eq(idVenteUnique(), 's1234-3', 'le suffixe avance tant que l’identifiant est pris');
    } finally { Date.now = maintenant; }
  });

  test('la fiche d’un bien propose de le vendre, et restaurer oublie la vente', () => {
    const a = app();
    vrai(/c\.statut !== 'archive' && estImmoEnDirect\(t\)\s*\? `<button class="btn ghost" data-action="vendre-bien"/.test(a),
      'le bouton ne vit que sur un bien détenu en direct, ouvert');
    const restaurer = a.slice(a.indexOf("async 'restaurer-compte'(btn)"), a.indexOf("async 'restaurer-compte'(btn)") + 1500);
    vrai(/delete c\.venduPar;/.test(restaurer), 'restaurer à la main efface la preuve de la vente');
    vrai(/if \(v\.typeActif === 'bien'\) \{ await annulerVenteDeBien\(i, v\); return; \}/.test(a),
      'l’annulation a sa propre confirmation');
    vrai(/v\.typeActif === 'bien' \? detailVenteBien\(v, r\)/.test(a), 'et le journal son propre détail');
    vrai(/projectionCredit\(d\)\.projete/.test(a.slice(a.indexOf('function askVenteBien('))),
      'le remboursement part du solde projeté, en repère');
  });

  test('ce que la vente dit se traduit', () => {
    for (const k of ['Vendre ce bien', 'Le prix solde d’abord ses crédits, le résultat se calcule sur ton coût d’acquisition',
                     'Le résultat se calcule sur ton coût d’acquisition',
                     'L’annulation défait cette vente, et elle seule. Réversible avec Ctrl+Z.',
                     'Prix de vente ({dev})', 'Remboursé sur {c} ({dev})', 'Frais de sortie du crédit ({dev})',
                     'Compte débité de la différence', 'Crédits soldés', 'Prix de vente, ta part', 'Coût d’acquisition',
                     'Le bien a changé depuis la vente : elle ne peut plus s’annuler.',
                     'Le prix ne couvre pas les crédits : désigne le compte qui paie la différence.',
                     'Vente annulée, le bien revient dans tes actifs', 'vendu {m}, ta part',
                     'Un bien vendu compte les frais de son crédit dans ce qu’il encaisse, pas dans son résultat.'])
      vrai(!!I18N.en[k], `« ${k.slice(0, 40)} » a sa traduction`);
  });
});

finDePartieDeTests('tests/31-vente-bien.tests.js');
