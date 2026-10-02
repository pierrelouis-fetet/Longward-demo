partieDeTests('tests/35-courbe-mensuelle.tests.js');
/* ------------------------------------------------------------------
   La carte d'evolution ne trace que des releves mensuels : pas de point du
   jour ajoute apres le dernier releve. Montants fictifs.
   ------------------------------------------------------------------ */
suite('La courbe d’évolution, relevé par relevé', () => {
  const app = () => (lireSource('assets/app.js') || '').replace(/\/\*[\s\S]*?\*\//g, '');
  /* Deux releves, chacun avec son capital restant du. */
  const poser = () => Fixture.poser(s => {
    s.monthly[0].dettes = 40000;
    s.monthly.push({ date: '2026-02-28', comment: '', dettes: 39000,
                     v: { c_courant: 3500, c_livret: 2000, c_pea: 10800, c_cto: 760, c_immo: 120000, c_pe: 2000 } });
  });

  test('la série de la carte s’arrête au dernier relevé, chacun avec sa dette', () => {
    poser();
    const pts = pointsEvolution({ net: true, financier: false, aujourdhui: false });
    eq(pts.length, 2, 'deux relevés, aucun point du jour');
    eq(pts.map(p => p.date).join(','), '2026-01-31,2026-02-28', 'dans l’ordre des relevés');
    pres(pts[0].total, rowTotal(Store.state.monthly[0]) - 40000, 'janvier avec la dette de janvier');
    pres(pts[1].total, rowTotal(Store.state.monthly[1]) - 39000, 'février avec la sienne, pas celle du jour');
    const brut = pointsEvolution({ net: false, financier: false, aujourdhui: false });
    pres(brut[1].total, rowTotal(Store.state.monthly[1]), 'en brut, le total du relevé');
  });

  test('la série par défaut garde son point du jour', () => {
    poser();
    const pts = pointsEvolution({ net: true, financier: false });
    eq(pts.length, 3, 'les deux relevés et aujourd’hui');
    eq(pts.at(-1).date, todayISO(), 'le dernier point est celui du jour');
    pres(pts.at(-1).total, patrimoine().net, 'au net du jour');
  });

  test('un relevé daté d’aujourd’hui garde sa dette, le point du jour la sienne', () => {
    Fixture.poser(s => {
      s.monthly[0].dettes = 40000;
      s.monthly.push({ date: todayISO(), comment: '', dettes: 39000,
                       v: { c_courant: 3500, c_livret: 2000, c_pea: 10800, c_cto: 760, c_immo: 120000, c_pe: 2000 } });
    });
    const pts = pointsEvolution({ net: true, financier: false });
    eq(pts.length, 3, 'deux relevés et le point du jour');
    eq(pts[1].date, pts[2].date, 'le relevé et le point du jour portent la même date');
    pres(pts[1].total, rowTotal(Store.state.monthly[1]) - 39000, 'le relevé garde la dette de son relevé');
    pres(pts[2].total, patrimoine().net, 'le point du jour celle du jour');
    vrai(pts.every(p => !('duJour' in p)), 'la marque ne sort pas de la série');
  });

  test('un seul relevé ne fait pas une courbe', () => {
    Fixture.poser();
    vrai(aUnRelevePatrimonial() && !courbeTracable(), 'un relevé : pas encore de courbe');
    poser();
    vrai(courbeTracable(), 'deux relevés : la courbe');
    const b = basculesEvolution({ net: true, financier: false, range: 'all', aujourdhui: false });
    vrai(typeof b.netBrut === 'boolean' && typeof b.perimetre === 'boolean', 'les bascules se jugent sur la même série');
  });

  test('la carte et ses bascules lisent la série sans point du jour', () => {
    const s = app();
    vrai(/pointsEvolution\(\{ net: evoNet, financier: evoFinancier, aujourdhui: false \}\)/.test(s), 'la courbe');
    vrai(/basculesEvolution\(\{ net: evoNet, financier: evoFinancier, range: evoRange, aujourdhui: false \}\)/.test(s),
      'et les bascules');
    vrai(/const perimetreUtile = courbeTracable\(\) && basculesAffichees\(\)\.perimetre;/.test(s),
      'pas de bascule de périmètre sans courbe');
    vrai(/trad\('La courbe se trace dès ton deuxième relevé mensuel\.'\)/.test(s), 'un relevé seul le dit');
    vrai(!!I18N.en['La courbe se trace dès ton deuxième relevé mensuel.']
      && !!I18N.en['Il faut deux relevés pour une pente : le second trace la courbe et donne le rythme.'],
      'et ses deux phrases se traduisent');
  });
});

finDePartieDeTests('tests/35-courbe-mensuelle.tests.js');
