partieDeTests('tests/41-creances-date-valeur.tests.js');
/* ------------------------------------------------------------------
   Ce qu'un tiers doit : un depot de garantie et un pret a un proche.
   Leur classe, leur poche, leur palier hors cumul, leur part plate dans
   la projection, leur formulaire sans prix d'achat, et leur sortie par
   restitution ou remboursement, journalisee sans fausser les ventes.
   Puis la date d'une valeur : le mot quand elle manque, et le geste qui
   la pose depuis la fiche. Montants fictifs.
   ------------------------------------------------------------------ */
suite('Créances : ce qu’un tiers te doit', () => {
  const CAUTION = 1200, PRET = 1000, DATE = '2026-06-15';
  const creance = (id, type, libelle, valeur, extra = {}) => ({
    id, etabId: null, type, statut: 'ouvert', ouvertLe: '2025-09-01', numero: '', notes: '',
    libelle, court: libelle, alloc: '', cash: [],
    lignes: [{ id: 'l_' + id, classe: 'creance', libelle, valeur, quantite: 1,
               dateAcquisition: '2025-09-01', ...extra }],
  });
  const poser = (modifier) => Fixture.poser(s => {
    s.comptes.push(creance('c_caution', 'depotGarantie', 'Caution', CAUTION),
                   creance('c_pret', 'pretProche', 'Prêt', PRET));
    if (modifier) modifier(s);
  });
  const somme = o => Object.values(o).reduce((s, v) => s + num(v), 0);
  /* Les fonctions d'ecran ne sont pas chargees par le harnais : elles se lisent
     dans la source et s'evaluent ensemble, le modele restant en portee. */
  const deApp = noms => {
    const src = lireSource('assets/app.js') || '';
    const corps = noms.map(nom => {
      let i = src.indexOf(`\nfunction ${nom}(`), fin;
      if (i >= 0) fin = src.indexOf('\n}\n', i) + 2;
      else {
        i = src.indexOf(`\nconst ${nom} =`);
        vrai(i >= 0, `${nom} doit être trouvable dans la source`);
        const objet = src.slice(i, src.indexOf('\n', i + 1)).trim().endsWith('{');
        fin = objet ? src.indexOf('\n};\n', i) + 3 : src.indexOf(';\n', i) + 1;
      }
      return src.slice(i, fin);
    }).join('\n');
    return new Function(`${corps}\nreturn { ${noms.join(', ')} };`)();
  };
  const cashCourant = () => num(compteById('c_courant').cash[0].montant);
  const recoit = () => ({ cashAccount: 'c_courant', cashPart: partieSuggeree('c_courant', { credit: true }), date: DATE });
  const statsVentes = () => {
    const st = salesStats('all');
    return JSON.stringify({ count: st.count, realised: st.realised, invested: st.invested, fiables: st.fiables,
                            nonFiables: st.nonFiables, partiel: st.partiel, gross: st.gross, pct: st.pct, wins: st.wins,
                            grossFiables: st.grossFiables, encaisseFiables: st.encaisseFiables });
  };

  test('une créance a sa classe, sa poche et sa teinte, et les poches refont le brut', () => {
    poser();
    pres(patrimoine().brut, Fixture.BRUT + CAUTION + PRET, 'les deux créances entrent dans le brut');
    const g = nowByGroup();
    pres(g.creances, CAUTION + PRET, 'leur poche porte les deux');
    pres(somme(g), patrimoine().brut, 'et la somme des poches refait le brut');
    eq(POCHE_EVOLUTION_DE_CLASSE.creance, 'creances', 'l’historique la range dans sa poche');
    vrai(POCHES_EVOLUTION.includes('creances') && CASCADE_DETTES.includes('creances'),
      'la pile et la cascade des dettes la connaissent toutes les deux');
    eq(TEINTE_CLASSE.creance, 13, 'elle a sa teinte, le neutre chaud');
    vrai(couleurClasse('creance') !== couleurClasse('unePoubelleInconnue'),
      'qui n’est pas celle des classes non attribuées');
    const t = typeCompte('depotGarantie');
    vrai(t.creance && t.terminal && t.sansEtab && !t.direct, 'un dépôt est une créance tenue par un tiers, sans établissement');
    vrai(typeCompte('pretProche').prete && typeCompte('pretProche').creance, 'un prêt à un proche est aussi un prêt');
    vrai(!estHorsPerimetreFinancier(compteById('c_caution')), 'une créance reste dans le périmètre financier');
    pres(poches({ financier: true }).classes.creance, CAUTION + PRET, 'et compte en vue Financier comme en vue Tout');
  });

  test('hors de la réserve et hors du cumul, mais dans les avoirs par disponibilité', () => {
    Fixture.poser();
    const sans = runway().tiers.filter(x => !x.horsCumul).map(x => round2(x.cumulative));
    poser();
    const p = poches();
    pres(p.mobilisable.aRecuperer, CAUTION + PRET, 'les deux créances tombent dans « à récupérer »');
    pres(somme(p.mobilisable), patrimoine().brut, 'les paliers refont le brut');
    const r = runway();
    const palier = r.tiers.find(x => x.label === trad(MOBILISABLE_LABEL.aRecuperer));
    vrai(palier && palier.horsCumul && palier.cumulative === null, 'le palier est affiché, hors cumul');
    eq(JSON.stringify(r.tiers.filter(x => !x.horsCumul).map(x => round2(x.cumulative))), JSON.stringify(sans),
      'les mois tenus ne comptent pas sur un tiers');
    pres(allocationParDisponibilite().reduce((s, x) => s + x.value, 0), patrimoine().brut,
      'la carte par disponibilité garde le brut pour total');
    const { MOBILISABLE_COURT } = deApp(['MOBILISABLE_COURT']);
    eq(MOBILISABLE_COURT.aRecuperer, 'À récupérer', 'la pastille de la fiche a son libellé court');
    compteById('c_pret').lignes[0].echeance = '2020-01-01';
    eq(mobiliteLigne(compteById('c_pret').lignes[0], compteById('c_pret')), 'aRecuperer',
      'une échéance passée ne rend pas le prêt disponible');
  });

  test('la projection les porte à plat, et ses poches refont le net', () => {
    const reglages = s => { delete s.meta.projScenario; s.meta.projRate = 5; s.meta.projRateAutres = 7;
                            s.meta.projRateGaranti = 2; s.meta.projMonthly = 0; };
    Fixture.poser(reglages);
    const sans = capitalisation({ years: 20 }).points.at(-1).total;
    poser(reglages);
    const q = pochesProjection();
    pres(q.creances, CAUTION + PRET, 'une poche à elles');
    const c = configProjection();
    pres(c.marche + c.autres + c.garanti + c.liquidites + c.plat, nowTotals().net,
      'les poches du moteur refont le patrimoine net, autres actifs à 7 %');
    pres(capitalisation({ years: 20 }).points.at(-1).total - sans, CAUTION + PRET,
      'vingt ans plus tard, elles valent toujours leur montant');
  });

  test('un relevé range ses créances dans leur poche, un relevé ancien n’en invente pas', () => {
    poser();
    const recent = pochesDuReleve({ c_courant: 3000, c_caution: CAUTION, c_pret: PRET });
    pres(recent.creances, CAUTION + PRET, 'la poche des créances porte les deux comptes');
    pres(somme(recent), 3000 + CAUTION + PRET, 'et la ventilation refait le relevé');
    const ancien = pochesDuReleve({ c_courant: 3000 });
    pres(num(ancien.creances), 0, 'un relevé d’avant les créances n’en a pas');
    pres(somme(ancien), 3000, 'et garde son total');
  });

  test('relu par la migration, un état garde ses créances, et deux lectures donnent le même état', () => {
    poser();
    Store.migrate(); refreshAccounts();
    const une = JSON.stringify(Store.state.comptes);
    Store.migrate(); refreshAccounts();
    eq(JSON.stringify(Store.state.comptes), une, 'deux lectures, un seul état');
    const c = compteById('c_caution');
    eq(c.type, 'depotGarantie', 'le type survit');
    eq(c.lignes[0].classe, 'creance', 'la classe aussi');
    pres(nowByGroup().creances, CAUTION + PRET, 'et les montants');
  });

  test('un patrimoine sans créance ne montre ni poche ni palier de plus', () => {
    Fixture.poser();
    pres(nowByGroup().creances, 0, 'la poche est vide');
    pres(pochesProjection().creances, 0, 'la projection n’a rien à porter');
    vrai(!runway().tiers.some(x => x.label === trad(MOBILISABLE_LABEL.aRecuperer)), 'aucun palier vide à l’accueil');
    vrai(!allocationParDisponibilite().some(x => x.cle === 'aRecuperer'), 'ni dans la carte des délais');
  });

  test('le formulaire d’une créance demande ce qui est dû, sans prix d’achat ni plus-value', () => {
    const cles = champs => champs.map(c => c.cle);
    const { champsPlacement } = deApp(['NOM_LIGNE_MAX', 'EXEMPLE_PLACEMENT', 'AIDE_VALEUR_PARTS', 'AIDE_VL', 'champsPlacement']);
    const { litPlacement } = deApp(['litPlacement']);
    const depot = champsPlacement('creance', null, false, typeCompte('depotGarantie'));
    const k = cles(depot);
    vrai(!k.includes('prixDeRevient') && !k.includes('estimeLe') && !k.includes('projet'),
      'ni prix d’achat, ni date de valeur, ni réserve de projet');
    eq(depot.find(c => c.cle === 'valeur').label, 'Montant dû ({dev})', 'le montant se dit dû');
    eq(depot.find(c => c.cle === 'dateAcquisition').label, trad('Date du versement'), 'la date est celle du versement');
    const pret = cles(champsPlacement('creance', null, true, typeCompte('pretProche')));
    vrai(['echeance', 'taux', 'statut'].every(x => pret.includes(x)), 'le prêt garde son échéance, son taux et son statut');
    const l = litPlacement({ libelle: 'Caution', valeur: 1300, dateAcquisition: '2025-09-01' },
                           { id: 'l', classe: 'creance', prixDeRevient: 999, prixAchat: 10 }, typeCompte('depotGarantie'));
    eq(l.prixDeRevient, null, 'aucun reliquat de coût ne survit');
    eq(coutAcquisition(l), null, 'son coût reste inconnu, donc aucune plus-value ne se calcule');
    eq(motCompte(typeCompte('depotGarantie')), trad('dépôt'), 'la fiche parle d’un dépôt');
    eq(titreActif(typeCompte('pretProche')), 'Le prêt', 'et d’un prêt');
    eq(titreActif(typeCompte('crowdfunding')), 'Le placement', 'un prêt participatif reste un placement');
  });

  test('une caution rendue en entier se solde sans écart, et le net ne bouge pas', () => {
    poser();
    const net = patrimoine().net, cash = cashCourant(), stats = statsVentes();
    const a = cederPlacement({ compteId: 'c_caution', index: 0, nature: 'restitution', produit: CAUTION, ...recoit() });
    vrai(a && !a.erreur, a && a.erreur);
    pres(a.realised, 0, 'rendue en entier : aucun écart');
    eq(a.pct, null, 'et aucun pourcentage');
    pres(cashCourant(), cash + CAUTION, 'l’argent arrive sur le compte');
    pres(patrimoine().net, net, 'transfert de forme');
    eq(compteById('c_caution').statut, 'archive', 'la caution soldée s’archive');
    const v = Store.state.sales[0];
    vrai(v.creance && v.cession === 'restitution', 'l’opération se dit restitution, et créance');
    eq(libelleReglement(v).ecart, 'Soldé sans écart', 'son écart se dit nul');
    eq(statsVentes(), stats, 'les statistiques des ventes ne bougent pas');
  });

  test('une caution amputée d’une retenue : l’écart est une perte, pas une moins-value', () => {
    poser();
    const net = patrimoine().net, stats = statsVentes();
    cederPlacement({ compteId: 'c_caution', index: 0, nature: 'restitution', produit: 1000, ...recoit() });
    const v = Store.state.sales[0];
    pres(v.realised, -200, 'deux cents euros retenus');
    pres(patrimoine().net, net - 200, 'le patrimoine baisse de la retenue');
    const m = libelleReglement(v);
    eq(m.operation, 'Dépôt de garantie restitué'); eq(m.ecart, 'Retenue');
    eq(resultatVente(v).fiable, false, 'ce n’est pas un résultat de vente');
    eq(statsVentes(), stats, 'et les ventes n’en savent rien');
  });

  test('un prêt remboursé en deux fois, puis un prêt en défaut après un premier versement', () => {
    poser();
    const net = patrimoine().net;
    cederPlacement({ compteId: 'c_pret', index: 0, nature: 'remboursement', capital: 300, produit: 300, ...recoit() });
    pres(compteById('c_pret').lignes[0].valeur, 700, 'il reste 700 à récupérer');
    pres(Store.state.sales[0].realised, 0, 'un remboursement sans intérêts n’a pas d’écart');
    const partiel = libelleReglement(Store.state.sales[0]);
    eq(`${partiel.operation}/${partiel.ecart}`, 'Remboursement partiel/Sans écart', 'et un versement partiel ne se dit jamais soldé');
    eq(compteById('c_pret').statut, 'ouvert', 'le prêt reste ouvert');
    cederPlacement({ compteId: 'c_pret', index: 0, nature: 'remboursement', capital: 700, produit: 750, ...recoit() });
    pres(Store.state.sales[0].realised, 50, 'cinquante euros d’intérêts');
    eq(libelleReglement(Store.state.sales[0]).ecart, 'Intérêts reçus', 'sur un prêt, un écart positif est un intérêt');
    eq(compteById('c_pret').statut, 'archive', 'soldé, il s’archive');
    pres(patrimoine().net, net + 50, 'le net gagne exactement les intérêts');

    poser();
    cederPlacement({ compteId: 'c_pret', index: 0, nature: 'remboursement', capital: 300, produit: 300, ...recoit() });
    cederPlacement({ compteId: 'c_pret', index: 0, nature: 'defaut', produit: 100, ...recoit() });
    const v = Store.state.sales[0];
    pres(v.realised, -600, 'le défaut perd ce qui restait, moins ce qui est revenu');
    eq(libelleReglement(v).operation, 'Prêt soldé en défaut');
    eq(libelleReglement(v).ecart, 'Perte');
    eq(compteById('c_pret').statut, 'archive', 'le défaut solde la ligne');
  });

  test('l’annulation rend la créance et reprend l’argent', () => {
    poser();
    const avant = JSON.stringify({ comptes: Store.state.comptes, sales: Store.state.sales || [] });
    cederPlacement({ compteId: 'c_caution', index: 0, nature: 'restitution', produit: 1000, ...recoit() });
    vrai(annulerVente(0), 'l’annulation passe');
    eq(JSON.stringify({ comptes: Store.state.comptes, sales: Store.state.sales || [] }), avant,
      'l’état d’avant revient à l’identique');
  });

  test('le journal et l’export : les ventes gardent leurs chiffres, les créances ont leur feuille', () => {
    poser(s => {
      s.sales = [{ id: 's_decl', date: '2026-03-10', name: 'Vente ancienne', declaree: true, gross: 500,
                   invested: 400, realised: 100, currency: 'EUR', qty: 0 }];
    });
    const { sheetSales, sheetCreances } = deApp(['sheetSales', 'sheetCreances']);
    const stats = statsVentes();
    const ventesAvant = JSON.stringify(sheetSales().rows);
    cederPlacement({ compteId: 'c_caution', index: 0, nature: 'restitution', produit: 1000, ...recoit() });
    cederPlacement({ compteId: 'c_pret', index: 0, nature: 'remboursement', capital: 300, produit: 300, ...recoit() });
    eq(statsVentes(), stats, 'les agrégats des ventes ignorent les deux opérations');
    eq(JSON.stringify(sheetSales().rows), ventesAvant, 'la feuille des ventes ne les porte pas');
    const j = journalVentes({ range: 'all' });
    eq(j.lignes.length, 3, 'le journal montre les trois opérations');
    const juin = j.groupes.find(g => g.mois === '2026-06');
    vrai(juin && juin.partiel === false && juin.sousTotal === null, 'un mois de créances seules n’est ni partiel ni chiffré');
    const f = sheetCreances();
    eq(f.name, 'Opérations sur créances', 'la feuille porte aussi les remboursements partiels');
    eq(f.cols.map(c => c.h).join('|'), 'Date|Créance|Opération|Montant réglé|Reçu|Écart|Crédité sur|Note',
      'les colonnes strictement nécessaires');
    eq(f.rows.length, 2, 'une ligne par opération');
    const caution = f.rows.find(r => r[1] === 'Caution');
    eq(caution.slice(2, 6).join('|'), 'Dépôt de garantie restitué|1200|1000|-200', 'la caution et sa retenue');
    const pret = f.rows.find(r => r[1] === 'Prêt');
    eq(pret.slice(2, 6).join('|'), 'Remboursement partiel|300|300|0', 'le premier remboursement, partiel');
  });

  test('les mots d’une opération de créance, pour chaque nature et chaque signe', () => {
    const mots = (cession, realised, soldee = true) => { const m = libelleReglement({ cession, realised, soldee }); return `${m.operation}/${m.ecart}`; };
    eq(mots('restitution', 0), 'Dépôt de garantie restitué/Soldé sans écart');
    eq(mots('restitution', -50), 'Dépôt de garantie restitué/Retenue');
    eq(mots('restitution', 20), 'Dépôt de garantie restitué/Reçu en plus', 'un supplément sur un dépôt n’a pas de nature connue');
    eq(mots('remboursement', 0), 'Prêt remboursé/Soldé sans écart');
    eq(mots('remboursement', 15), 'Prêt remboursé/Intérêts reçus');
    eq(mots('remboursement', -15), 'Prêt remboursé/Perte');
    eq(mots('defaut', -300), 'Prêt soldé en défaut/Perte');
    eq(mots('defaut', 0), 'Prêt soldé en défaut/Soldé sans écart');
    eq(mots('defaut', 10), 'Prêt soldé en défaut/Intérêts reçus');
    eq(mots('remboursement', 0, false), 'Remboursement partiel/Sans écart', 'un versement partiel n’est pas un solde');
    eq(mots('remboursement', 12, false), 'Remboursement partiel/Intérêts reçus');
    const m = libelleReglement({ cession: 'restitution', realised: -200, soldee: true });
    pres(m.absolu, 200, 'le montant se lit sans signe après son mot');
    pres(m.montant, -200, 'et garde son signe pour l’export');
  });
});

suite('La date d’une valeur se lit et se pose depuis la fiche', () => {
  const fonds = (lignes) => Fixture.poser(s => {
    s.comptes.push({ id: 'c_fonds', etabId: 'e_pe', type: 'fondsNonCote', statut: 'ouvert', ouvertLe: '2024-01-01',
                     numero: '', notes: '', libelle: 'Fonds', court: 'Fonds', alloc: '', cash: [], lignes });
  });
  const ligneFonds = extra => ({ id: 'l_f' + Math.random().toString(36).slice(2, 6), classe: 'nonCote', libelle: 'Fonds',
                                 valeur: 1000, parts: 10, quantite: 1, dateAcquisition: '2024-01-01', ...extra });

  test('sans date, la phrase le dit en clair, et la fiche propose de la dater', () => {
    const src = lireSource('assets/app.js') || '';
    const i = src.indexOf('\nfunction phraseDateValeur(');
    const phraseDateValeur = new Function(`${src.slice(i, src.indexOf('\n}\n', i) + 2)}\nreturn phraseDateValeur;`)();
    eq(phraseDateValeur({ genre: 'vl', date: '' }), trad('valeur non datée'), 'plus de « sans date de VL »');
    fonds([ligneFonds({ estimeLe: '' })]);
    eq(gesteDateValeur(compteById('c_fonds')), 'Dater la valeur', 'une VL absente se pose depuis la fiche');
  });

  test('une VL dépassée se met à jour, une VL fraîche ne demande rien', () => {
    fonds([ligneFonds({ estimeLe: '2020-01-01', vlPeriode: 'trimestre' })]);
    eq(gesteDateValeur(compteById('c_fonds')), 'Mettre à jour la valeur', 'une VL de six ans a passé sa cadence');
    fonds([ligneFonds({ estimeLe: todayISO(), vlPeriode: 'trimestre' })]);
    eq(gesteDateValeur(compteById('c_fonds')), null, 'une VL du jour ne demande rien');
  });

  test('le geste ne se propose que là où la fiche et la fenêtre parlent de la même ligne', () => {
    fonds([ligneFonds({ estimeLe: '' }), ligneFonds({ estimeLe: '' })]);
    eq(gesteDateValeur(compteById('c_fonds')), null, 'deux lignes : chacune porte déjà son bouton');
    Fixture.poser(s => {
      s.comptes.push({ id: 'c_caution', etabId: null, type: 'depotGarantie', statut: 'ouvert', ouvertLe: '2025-09-01',
                       numero: '', notes: '', libelle: 'Caution', court: 'Caution', alloc: '', cash: [],
                       lignes: [{ id: 'l_c', classe: 'creance', libelle: 'Caution', valeur: 800, quantite: 1 }] });
    });
    eq(gesteDateValeur(compteById('c_caution')), null, 'une créance ne se date pas');
    eq(gesteDateValeur(compteById('c_pe')), null, 'un prêt participatif vaut son nominal');
    Fixture.poser(s => {
      s.comptes.push({ id: 'c_scpi', etabId: 'e_pe', type: 'scpi', statut: 'ouvert', ouvertLe: '2024-01-01',
                       numero: '', notes: '', libelle: 'SCPI', court: 'SCPI', alloc: '', cash: [],
                       lignes: [{ id: 'l_s', classe: 'immobilier', libelle: 'SCPI', valeur: 5000, parts: 20, quantite: 1, estimeLe: '' }] });
    });
    eq(gesteDateValeur(compteById('c_scpi')), 'Dater la valeur', 'une SCPI à une ligne se date aussi depuis sa fiche');
  });
});
finDePartieDeTests('tests/41-creances-date-valeur.tests.js');
