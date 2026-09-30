partieDeTests('tests/32-supports-dates.tests.js');
/* ------------------------------------------------------------------
   Les supports saisis a la main d'un contrat mixte (un fonds en euros, une
   unite de compte sans cours) datent du releve qui donne leur valeur, et se
   rappellent une fois l'an. Montants fictifs.
   ------------------------------------------------------------------ */
suite('Supports datés d’un contrat', () => {
  const app = () => (lireSource('assets/app.js') || '').replace(/\/\*[\s\S]*?\*\//g, '');
  const ilYA = jours => isoDeDate(new Date(Date.now() - jours * 864e5));
  const support = (id, valeur, estimeLe) => ({ id, classe: 'garanti', libelle: id, valeur,
    prixDeRevient: null, dateAcquisition: '', ...(estimeLe !== undefined ? { estimeLe } : {}) });

  /* Une assurance-vie qui porte un titre cote et des supports saisis. */
  const poser = lignes => Fixture.poser(s => {
    s.comptes.push({ id: 'c_av', etabId: 'e_banque', type: 'av', statut: 'ouvert', ouvertLe: '2020-01-01',
                     numero: '', notes: '', libelle: 'Assurance-vie', court: 'AV', alloc: '', cash: [], lignes });
    s.positions.push({ id: 'p_av', name: 'Fonds monde', isin: '', symbol: 'MONDE', currency: 'EUR', qty: 10,
                       buyPrice: 100, price: 110, fx: 1, fxBuy: 1, account: 'c_av', manual: false,
                       assetClass: 'actions', role: 'core' });
  });

  test('un support de contrat mixte se lit sur un relevé, pas ailleurs', () => {
    for (const id of ['av', 'per', 'pee', 'pereco', 'us401k'])
      vrai(valeurDeReleve(typeCompte(id)), `${id} : ses supports saisis datent de leur relevé`);
    for (const id of ['immo', 'pe', 'cto', 'fondsNonCote', 'courant'])
      vrai(!valeurDeReleve(typeCompte(id)), `${id} : non`);
    vrai(!estValeurEstimee(typeCompte('av')) && !typeCompte('av').vl, 'ni une estimation ni une VL publiée');
  });

  test('l’en-tête dit les cours, puis la date des supports, la plus ancienne', () => {
    poser([support('Fonds euros', 5000, ilYA(300)), support('UC maison', 2000, ilYA(100))]);
    const d = datesDuCompte(compteById('c_av'));
    eq(d.map(x => x.genre).join(','), 'cours,releve', 'cours d’abord, supports ensuite');
    eq(d[1].date, ilYA(300), 'un contrat n’est pas plus frais que son support le plus ancien');
    poser([support('Fonds euros', 5000, ilYA(300)), support('UC maison', 2000)]);
    eq(datesDuCompte(compteById('c_av'))[1].date, null, 'un support sans date rend la date inconnue');
    poser([support('Fonds euros', 5000, ilYA(300)), support('Vide', 0)]);
    eq(datesDuCompte(compteById('c_av'))[1].date, ilYA(300), 'un support à zéro ne compte pas');
  });

  test('un support vieux d’un an se rappelle, et le rappel ouvre sa fenêtre', () => {
    poser([support('Fonds euros', 5000, ilYA(300)), support('UC maison', 2000, ilYA(500)),
           support('UC ancienne', 1000), support('Vide', 0)]);
    const r = valeursARevoir().filter(x => x.compteId === 'c_av');
    eq(r.length, 2, 'le support frais et celui à zéro se taisent');
    const vieux = r.find(x => x.date);
    eq(vieux.date, ilYA(500), 'le support daté de plus d’un an');
    vrai(vieux.releve && !vieux.publiee && vieux.genre === 'estimation', 'dit comme une valeur relevée');
    eq(JSON.stringify(vieux.ouvre), JSON.stringify({ action: 'editer-placement', id: 'c_av', i: 1 }),
      'et vise son propre rang : sur deux supports, c’est le second qui a vieilli');
    eq(vieux.route, '#/compte/c_av', 'la route de la fiche reste');
    eq(vieux.ancre, 'estimation', 'et l’ancre aussi');
    const sans = r.find(x => !x.date);
    eq(sans.ouvre.i, 2, 'un support sans date est à revoir, lui aussi');
    vrai(!valeursARevoir().some(x => x.nom === 'Fonds monde'), 'jamais le titre coté du contrat');
    vrai(aRafraichir().some(x => x.releve && x.nom === vieux.nom), 'et le bloc d’avant relevé le reprend');
  });

  test('la date suit la règle d’une VL : elle date du relevé, pas de l’enregistrement', () => {
    const jour = '2026-06-15', releve = '2025-12-31';
    eq(dateApresSaisie({ avant: 5000, apres: 5000, dateAvant: releve, dateSaisie: releve, genre: 'vl', jour }),
      releve, 'changer le seul nom garde la date du relevé');
    eq(dateApresSaisie({ avant: 5000, apres: 5100, dateAvant: releve, dateSaisie: releve, genre: 'vl', jour }),
      null, 'corriger le montant sans sa date la rend inconnue');
    eq(dateApresSaisie({ avant: 5000, apres: 5100, dateAvant: releve, dateSaisie: '2026-01-31', genre: 'vl', jour }),
      '2026-01-31', 'montant et date changés : la date saisie');
    poser([support('Fonds euros', 5000, releve)]);
    const i = COMPTES().findIndex(c => c.id === 'c_av');
    eq(JSON.stringify(dateQuiSuit(`comptes.${i}.lignes.0.valeur`)),
      JSON.stringify({ chemin: `comptes.${i}.lignes.0.estimeLe`, genre: 'vl' }), 'la frappe suit la même règle');
    vrai(/const genre = estValeurEstimee\(t\) \|\| valeurAuPrixDeRetrait\(t\) \? 'estimation' : 'vl';/.test(app())
      && !valeurAuPrixDeRetrait(typeCompte('av')),
      'la fenêtre du support la range avec les VL');
  });

  test('la fenêtre, la liste et la fiche le disent', () => {
    const a = app();
    const ch = a.slice(a.indexOf('function champsPlacement('), a.indexOf('\n}\n', a.indexOf('function champsPlacement(')));
    vrai(/const releve = valeurDeReleve\(type\);/.test(ch), 'le champ de date vient du prédicat');
    vrai(/releve \? 'Dernière valeur connue'/.test(ch), 'le montant se dit « Dernière valeur connue »');
    vrai(/releve \? 'la date de ce relevé : corrige-la s’il est plus ancien qu’aujourd’hui'/.test(ch),
      'et sa date dit de la corriger si le relevé est plus ancien');
    eq((a.match(/cle: 'estimeLe'/g) || []).length, 2, 'toujours un seul champ de date par fenêtre');
    const carte = a.slice(a.indexOf('function carteValeursARevoir'), a.indexOf('function viewAccounts'));
    vrai(/\$\{x\.ouvre \? `data-action="\$\{esc\(x\.ouvre\.action\)\}" data-id="\$\{esc\(x\.ouvre\.id\)\}" data-i="\$\{x\.ouvre\.i\}"`/.test(carte),
      'une ligne de support ouvre sa fenêtre');
    vrai(/x\.releve \? d \? trad\('valeur au \{d\}'\)|if \(x\.releve\) return d \? trad\('valeur au \{d\}'\)/.test(carte),
      'et dit « valeur au »');
    vrai(/x\.genre === 'releve'\) return d \? trad\('supports au \{d\}'\)/.test(a), 'l’en-tête dit « supports au »');
    vrai(/x\.releve \? \(d \? trad\('valeur au \{d\}'\)/.test(a.slice(a.indexOf('function blocFraicheur'))),
      'le bloc d’avant relevé aussi');
    vrai(/<div class="card"\$\{valeurDeReleve\(t\) \? ' data-anchor="estimation"' : ''\}>/.test(a),
      'la carte des supports porte l’ancre des valeurs à revoir');
    const lp = a.slice(a.indexOf('function lignePlacement('), a.indexOf('\n}\n', a.indexOf('function lignePlacement(')));
    vrai(/const dateReleve = brute && valeurDeReleve\(typeCompte\(compte\.type\)\)/.test(lp) && /parPart, dateReleve,/.test(lp),
      'chaque support dit sa date sous son nom');
    vrai(!/Relevé sans date|relevé sans date|relevé du \{d\}/.test(a),
      'aucun texte ne dit « relevé » seul pour un support : le relevé, ici, est celui du mois');
  });

  test('ce que disent les supports se traduit', () => {
    for (const k of ['Dernière valeur connue ({dev})', 'Valeur au', 'supports au {d}', 'supports sans date',
                     'valeur au {d}', 'valeur sans date',
                     'celle que donne ton dernier relevé de l’assureur ou du teneur de compte : elle date du jour de ce relevé',
                     'la date de ce relevé : corrige-la s’il est plus ancien qu’aujourd’hui',
                     'Des soldes, des estimations, des valeurs de supports et des capitaux restant dus qui datent ou n’ont pas de date. Touche une ligne pour ouvrir le champ.'])
      vrai(!!I18N.en[k], `« ${k.slice(0, 40)} » a sa traduction`);
  });
});

finDePartieDeTests('tests/32-supports-dates.tests.js');
