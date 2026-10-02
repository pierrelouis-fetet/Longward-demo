partieDeTests('tests/37-caps-du-patrimoine.tests.js');
/* ------------------------------------------------------------------
   Les caps du patrimoine net : un releve qui atteint un palier rond que le
   precedent n'atteignait pas. Le calcul, la decision de feter apres une
   sauvegarde, et la regle d'insight. Montants fictifs.
   ------------------------------------------------------------------ */
suite('Les caps du patrimoine net', () => {
  /* Des points de releve tels que historySeries les rend : une date, un mois
     lisible, un net. */
  const pt = (date, net) => ({ date, label: date.slice(0, 7), net });
  const caps = pts => capsFranchis(pts).map(c => `${c.cap}@${c.date}`).join(',');

  test('un cap se franchit quand un relevé l’atteint et que le précédent était en dessous', () => {
    eq(caps([pt('2026-01-01', 95000), pt('2026-02-01', 101000)]), '100000@2026-02-01', 'la hausse qui passe 100 000');
    eq(caps([pt('2026-01-01', 200000), pt('2026-02-01', 250000)]), '250000@2026-02-01', 'pile sur le cap : atteint');
    eq(caps([pt('2026-01-01', 101000), pt('2026-02-01', 99000)]), '', 'une baisse ne produit rien');
    eq(caps([pt('2026-01-01', 120000)]), '', 'un seul relevé n’a pas d’avant');
    eq(caps([]), '', 'aucun relevé, aucun cap');
  });

  test('ce que le premier relevé atteint déjà n’est jamais fêté', () => {
    eq(caps([pt('2026-01-01', 210000), pt('2026-02-01', 190000), pt('2026-03-01', 205000)]), '',
      '200 000 était là avant le suivi');
  });

  test('un cap ne se franchit qu’une fois', () => {
    eq(caps([pt('2026-01-01', 95000), pt('2026-02-01', 101000), pt('2026-03-01', 97000), pt('2026-04-01', 103000)]),
      '100000@2026-02-01', 'repassé après une baisse, il ne revient pas');
  });

  test('plusieurs caps d’un coup : tous notés, le plus haut se nomme', () => {
    const pts = [pt('2026-01-01', 90000), pt('2026-02-01', 260000)];
    eq(caps(pts), '100000@2026-02-01,150000@2026-02-01,200000@2026-02-01,250000@2026-02-01', 'dans l’ordre croissant');
    eq(capDuReleve('2026-02-01', capsFranchis(pts)).cap, 250000, 'le plus haut');
    eq(capDuReleve('2026-01-01', capsFranchis(pts)), null, 'rien au premier relevé');
  });

  test('l’ordre des relevés reçus ne change rien', () => {
    eq(caps([pt('2026-03-01', 103000), pt('2026-01-01', 95000), pt('2026-02-01', 99000)]),
      '100000@2026-03-01', 'triés par date avant d’être lus');
  });

  test('un net négatif qui remonte franchit les caps qu’il atteint', () => {
    eq(caps([pt('2026-01-01', -20000), pt('2026-02-01', 12000)]), '10000@2026-02-01', 'de −20 000 à 12 000');
  });

  test('le dernier cap, et combien de relevés sont venus après', () => {
    const d = dernierCap([pt('2026-04-01', 195000), pt('2026-05-01', 199000), pt('2026-06-01', 201000),
                          pt('2026-07-01', 202000), pt('2026-08-01', 204000)]);
    eq(d.cap, 200000); eq(d.date, '2026-06-01'); eq(d.relevesDepuis, 2);
    eq(d.avant, 199000); eq(d.apres, 201000); eq(d.labelPrecedent, '2026-05');
    eq(dernierCap([pt('2026-04-01', 195000), pt('2026-05-01', 196000)]), null, 'aucun franchissement');
  });

  test('fêter après une sauvegarde : le dernier relevé, un cap nouveau', () => {
    const avant = capsFranchis([pt('2026-07-01', 199000)]);
    const apres = capsFranchis([pt('2026-07-01', 199000), pt('2026-08-01', 201000)]);
    eq(capAFeter(avant, apres, '2026-08-01', '2026-08-01').cap, 200000, 'le relevé du jour franchit');
    eq(capAFeter(avant, apres, '2026-08-01', '2026-09-01'), null, 'un relevé qui n’est pas le dernier ne fête rien');
    eq(capAFeter(apres, apres, '2026-08-01', '2026-08-01'), null, 'le même cap déjà noté ne refête pas');
    const ancien = capsFranchis([pt('2026-06-01', 99000), pt('2026-07-01', 101000), pt('2026-08-01', 102000)]);
    eq(capAFeter([], ancien, '2026-07-01', '2026-08-01'), null, 'corriger un ancien relevé ne fête rien');
    const baisse = capsFranchis([pt('2026-07-01', 205000), pt('2026-08-01', 195000)]);
    eq(capAFeter([], baisse, '2026-08-01', '2026-08-01'), null, 'une baisse ne fête rien');
    const saut = capsFranchis([pt('2026-07-01', 90000), pt('2026-08-01', 260000)]);
    eq(capAFeter([], saut, '2026-08-01', '2026-08-01').cap, 250000, 'deux caps d’un coup : le plus haut');
  });

  /* La regle lit des releves poses dans l'etat, comme les autres regles. */
  const releve = (date, cash) => ({ date, comment: '', dettes: 0, v: { a: 1 }, parts: { a: { cash } } });
  const regle = () => REGLES_INSIGHT.find(r => r.id === 'wealth_milestone');
  const lire = (montants, aujourdhui) => {
    Fixture.poser(s => { s.monthly = montants.map(([d, v]) => releve(d, v)); });
    const m = { releves: historySeries({ includeNow: false }), aujourdhui };
    return regle().eligible(m) ? regle().evaluer(m) : null;
  };

  test('l’insight dit un cap récent, avec ses deux relevés', () => {
    vrai(!!regle(), 'la règle existe');
    const r = lire([['2026-05-01', 199000], ['2026-06-01', 201000], ['2026-07-01', 202000], ['2026-08-01', 204000]],
      '2026-10-02');
    vrai(!!r, 'deux relevés après, quatre mois : il parle');
    eq(r.params.cap, 200000); eq(r.params.before, 199000); eq(r.params.after, 201000);
    eq(r.action.vue, 'history', 'il mène au journal');
    eq(r.evidence.statementsSince, 2);
  });

  test('l’insight se tait quand le cap date', () => {
    eq(lire([['2026-04-01', 199000], ['2026-05-01', 201000], ['2026-06-01', 202000], ['2026-07-01', 203000],
             ['2026-08-01', 204000]], '2026-09-01'), null, 'trois relevés après : plus une nouvelle');
    eq(lire([['2025-01-01', 199000], ['2026-01-01', 201000], ['2026-08-01', 204000]], '2026-09-01'), null,
      'un cap vieux de huit mois se tait, même à un relevé du dernier');
    eq(lire([['2026-01-01', 199000], ['2026-02-01', 201000]], '2026-09-01'), null,
      'un dernier relevé vieux de sept mois ne parle plus');
    eq(lire([['2026-07-01', 205000], ['2026-08-01', 210000]], '2026-09-01'), null,
      'un cap atteint dès le premier relevé ne se dit pas');
  });

  test('le plus récent pèse le plus', () => {
    const recent = lire([['2026-07-01', 199000], ['2026-08-01', 201000]], '2026-09-01');
    const moins = lire([['2026-06-01', 199000], ['2026-07-01', 201000], ['2026-08-01', 202000]], '2026-09-01');
    vrai(recent.poids > moins.poids, `${recent.poids} contre ${moins.poids}`);
  });

  test('l’insight a son étiquette, ses mots et sa destination dans les deux langues', () => {
    vrai(!!I18N.en['Cap'] && !!I18N.en['Cap franchi'], 'le surtitre et le titre');
    for (const k of ['ton relevé de {m} l’atteint ou le dépasse', '{a} au relevé précédent',
                     'Ton relevé de {m} atteint ou dépasse ce cap ; celui de {p} était en dessous.'])
      vrai(!!I18N.en[k], `« ${k.slice(0, 40)} » traduit`);
  });
});

finDePartieDeTests('tests/37-caps-du-patrimoine.tests.js');
