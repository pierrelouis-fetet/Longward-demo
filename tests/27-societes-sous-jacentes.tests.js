partieDeTests('tests/27-societes-sous-jacentes.tests.js');
/* ------------------------------------------------------------------
   Les societes sous-jacentes : plusieurs participations dans une meme
   societe font une seule exposition, mais seulement une fois declarees.
   Noms et montants fictifs.
   ------------------------------------------------------------------ */
suite('Plusieurs participations, une seule société', () => {
  const compte = (id, etabId, type, libelle, lignes, cash = []) => ({
    id, etabId, type, statut: 'ouvert', ouvertLe: '2024-01-01', numero: '', notes: '',
    libelle, court: libelle, alloc: '', cash, lignes });
  const ligne = (id, libelle, valeur, extra = {}) => ({
    id, classe: 'nonCote', libelle, valeur, prixDeRevient: valeur, quantite: 1,
    dateAcquisition: '', ...extra });
  /* Trois participations : deux levees d'une meme societe, chacune plus petite
     qu'une troisieme au nom voisin, et qui la depassent ensemble. */
  const poser = modifier => Fixture.poser(e => {
    e.etabs.push({ id: 'e_nova', nom: 'Plateforme Nova', notes: '', dettes: [] });
    e.comptes.push(
      compte('c_n1', 'e_nova', 'pe', 'Atelier Nova shares', [ligne('l_n1', 'Atelier Nova shares', 30000)]),
      compte('c_n2', 'e_nova', 'pe', 'Atelier Nova shares 2', [ligne('l_n2', 'Atelier Nova shares 2', 25000)]),
      compte('c_nl', 'e_nova', 'pe', 'Atelier Novalis', [ligne('l_nl', 'Atelier Novalis', 40000)]));
    if (modifier) modifier(e);
  });
  /* La clef d'une ligne se lit a chaque appel : un refus la rend durable, et
     elle change alors de forme. `rang` departage deux homonymes d'un compte. */
  const cleDe = (compteId, ligneId, rang = 0) => {
    const p = participations().filter(x => x.compte.id === compteId && x.id === ligneId)[rang];
    return p ? p.cle : null;
  };
  const entite = cle => entiteParCle(cle);
  const lier = () => {
    const s = suggestionsRapprochement();
    eq(s.length, 1, 'une seule proposition avant de lier');
    return confirmerRapprochement(s[0].a, s[0].b, '');
  };
  const barres = financier => allocationByAsset({ credits: false, financier, parSociete: true })
    .filter(l => l.value > 0.005);

  test('le nom se compare sans les mots du titre, jamais sans une fin de mot', () => {
    eq(normaliserNomSociete('Atelier Nova shares'), 'atelier nova', 'le mot du titre part');
    eq(normaliserNomSociete('Atelier Nova shares 2'), 'atelier nova', 'le numéro de levée aussi');
    eq(normaliserNomSociete('Parts de l’Atelier Nova'), 'atelier nova', 'en tête, le mot du titre et sa liaison');
    eq(normaliserNomSociete('ATELIER NOVA, Série A'), 'atelier nova', 'casse, ponctuation et série');
    eq(normaliserNomSociete('Atelier Novalis'), 'atelier novalis', 'une fin de mot reste');
    eq(normaliserNomSociete('Parts 2'), '', 'un nom qui ne nomme rien est vide');
    eq(nomSocietePropose('Atelier Nova shares 2'), 'Atelier Nova', 'le nom proposé garde son écriture');
  });

  test('des levées de la même société se proposent, un nom voisin non', () => {
    poser();
    const s = suggestionsRapprochement();
    eq(s.length, 1, 'une seule proposition');
    const cles = [s[0].a.cle, s[0].b.cle].sort();
    eq(cles.join(' '), [`l:${cleDe('c_n1', 'l_n1')}`, `l:${cleDe('c_n2', 'l_n2')}`].sort().join(' '),
      'elle réunit les deux levées, pas le nom voisin');
    /* Proposer n'est pas regrouper : avant la reponse, chacune compte seule. */
    const b = barres(true);
    vrai(b.some(l => l.label === 'Atelier Nova shares') && b.some(l => l.label === 'Atelier Nova shares 2'),
      'sans confirmation, les deux levées restent deux lignes');
    eq(concentration({ financier: true }).premiere.label, 'Atelier Novalis',
      'et la première exposition reste la plus grosse ligne seule');
  });

  test('deux participations liées font une exposition, et passent en tête', () => {
    poser();
    const id = lier();
    vrai(id && societeParId(id), 'la société existe');
    eq(societeParId(id).nom, 'Atelier Nova', 'sous le nom proposé');
    for (const financier of [true, false]) {
      const b = barres(financier);
      const base = financier ? totalFinancier() : nowTotals().brut;
      pres(b.reduce((s, l) => s + l.value, 0), base,
        `les barres somment leur base annoncée (${financier ? 'financier' : 'tout'})`);
      const nova = b.find(l => l.cle === `societe:${id}`);
      vrai(nova, 'la société a sa barre');
      pres(nova.value, 55000, 'qui vaut la somme de ses participations');
      pres(nova.pct, 55000 / base * 100, 'et sa part se prend sur la même base');
      vrai(!b.some(l => /Atelier Nova shares/.test(l.label)), 'les levées ne se comptent plus à part');
      vrai(/2 participations/.test(nova.sous), 'le sous-titre dit combien elle en réunit');
    }
    const c = concentration({ financier: true });
    eq(c.premiere.label, 'Atelier Nova', 'la première exposition est la société');
    pres(c.premiere.pct, 55000 / totalFinancier() * 100, 'sur les avoirs financiers');
    const b = barres(true);
    pres(c.top3.value, b.slice(0, 3).reduce((s, l) => s + l.value, 0), 'le top 3 se refait sur les groupes');
    const g = groupesSocietes({ financier: true });
    eq(g.length, 1, 'une société');
    eq(g[0].participations.length, 2, 'avec ses deux participations');
    pres(g[0].valeur, 55000, 'et leur somme');
  });

  test('deux libellés identiques ne se somment pas sans confirmation', () => {
    poser(e => {
      e.comptes.find(c => c.id === 'c_n2').lignes[0].libelle = 'Atelier Nova shares';
      e.comptes.find(c => c.id === 'c_n2').libelle = 'Atelier Nova shares';
    });
    const b = barres(true).filter(l => l.label === 'Atelier Nova shares');
    eq(b.length, 2, 'deux barres du même nom, et non une somme');
    eq(new Set(b.map(l => l.cle)).size, 2, 'chacune sous la clef de sa ligne');
    eq(concentration({ financier: true }).premiere.label, 'Atelier Novalis',
      'la concentration ne les réunit pas d’elle-même');
    eq(suggestionsRapprochement().length, 1, 'mais elles se proposent');
  });

  test('une participation sans société compte pour elle-même', () => {
    poser();
    lier();
    const nl = barres(true).find(l => l.label === 'Atelier Novalis');
    vrai(nl, 'le nom voisin garde sa ligne');
    eq(nl.cle, `ligne:${cleDe('c_nl', 'l_nl')}`, 'sous la clef de sa ligne, pas de son libellé');
    pres(nl.value, 40000, 'et sa valeur');
  });

  test('dissocier rend les lignes, et une société vide disparaît', () => {
    poser();
    const id = lier();
    vrai(dissocierParticipation(cleDe('c_n2', 'l_n2')), 'la dissociation se fait');
    const b = barres(true);
    vrai(b.some(l => l.label === 'Atelier Nova shares 2'), 'la levée retrouve sa ligne');
    pres(b.find(l => l.cle === `societe:${id}`).value, 30000, 'la société garde l’autre');
    dissocierParticipation(cleDe('c_n1', 'l_n1'));
    eq(societesDeclarees().length, 0, 'sans participation, la société part');
    eq(Store.state.comptes.find(c => c.id === 'c_n1').lignes[0].valeur, 30000, 'aucune valeur n’a bougé');
  });

  test('la valeur est la part détenue', () => {
    poser(e => { e.comptes.find(c => c.id === 'c_n2').lignes[0].part = 40; });
    const id = lier();
    pres(groupesSocietes({ financier: true })[0].valeur, 30000 + 25000 * 0.4, 'quote-part appliquée');
    pres(barres(true).find(l => l.cle === `societe:${id}`).value, 40000, 'et la barre dit la même chose');
    pres(barres(true).reduce((s, l) => s + l.value, 0), totalFinancier(), 'et la somme vaut encore la base');
  });

  test('un fonds et un prêt participatif ne sont pas des participations', () => {
    poser(e => {
      e.comptes.push(
        compte('c_f', 'e_nova', 'fondsNonCote', 'Atelier Nova shares', [ligne('l_f', 'Atelier Nova shares', 5000)]),
        compte('c_p', 'e_nova', 'crowdfunding', 'Atelier Nova shares 3', [ligne('l_p', 'Atelier Nova shares 3', 4000)]));
    });
    const cles = participations().map(p => p.compte.id);
    vrai(!cles.includes('c_f') && !cles.includes('c_p') && !cles.includes('c_pe'),
      'ni le fonds, ni les prêts ne sont des participations');
    eq(suggestionsRapprochement().length, 1, 'et ils ne se proposent pas');
    const f = barres(true).filter(l => l.label === 'Atelier Nova shares');
    eq(f.length, 2, 'le fonds reste sa propre ligne, à côté de la levée du même nom');
  });

  test('un crédit ne réduit pas l’exposition, il se lit à côté', () => {
    poser(e => {
      e.etabs.find(x => x.id === 'e_nova').dettes.push(
        { id: 'd_n1', libelle: 'Prêt', montant: 10000, note: '', bienId: 'c_n1' });
    });
    const id = lier();
    const c = concentration({ financier: true });
    pres(c.premiere.value, 55000, 'l’exposition reste brute');
    const g = groupesSocietes({ financier: true })[0];
    eq(g.credits.length, 1, 'le crédit du compte se lit');
    pres(g.credits[0].du, 10000, 'pour son montant');
    vrai(g.credits[0].exclusif, 'ce compte ne porte que la société');
    pres(g.netApresCredit, 45000, 'le net après crédit se calcule alors');
    pres(barres(false).find(l => l.cle === `societe:${id}`).value, 55000,
      'et en vue Tout aussi, la barre compte en brut');
  });

  test('un crédit sur un compte partagé ne se retranche de rien', () => {
    poser(e => {
      const c1 = e.comptes.find(c => c.id === 'c_n1');
      c1.lignes.push(ligne('l_orion', 'Maison Orion', 8000));
      e.etabs.find(x => x.id === 'e_nova').dettes.push(
        { id: 'd_n1', libelle: 'Prêt', montant: 10000, note: '', bienId: 'c_n1' });
    });
    lier();
    const g = groupesSocietes({ financier: true })[0];
    eq(g.credits.length, 1, 'le crédit se lit');
    vrai(!g.credits[0].exclusif, 'mais le compte porte aussi une autre société');
    eq(g.netApresCredit, null, 'donc aucun net ne se suppose');
    pres(g.valeur, 55000, 'et l’exposition ne bouge pas');
  });

  test('un refus tient, même par un détour', () => {
    poser(e => {
      e.comptes.push(compte('c_n3', 'e_nova', 'pe', 'Atelier Nova shares 3',
        [ligne('l_n3', 'Atelier Nova shares 3', 5000)]));
    });
    const n1 = () => `l:${cleDe('c_n1', 'l_n1')}`, n2 = () => `l:${cleDe('c_n2', 'l_n2')}`;
    const n3 = () => `l:${cleDe('c_n3', 'l_n3')}`;
    eq(suggestionsRapprochement().length, 3, 'trois levées, trois paires');
    ecarterRapprochement(entite(n1()), entite(n2()));
    eq(suggestionsRapprochement().length, 2, 'la paire refusée ne revient pas');
    vrai(Store.state.meta.rapprochementsEcartes.every(p => Array.isArray(p) && p.length === 2),
      'un refus se range en paire, sans séparateur');
    const id = confirmerRapprochement(entite(n1()), entite(n3()), '');
    vrai(id, 'la première et la troisième se lient');
    eq(suggestionsRapprochement().length, 0,
      'la deuxième ne se propose pas à leur société : elle contient la paire refusée');
  });

  test('deux sociétés ne fusionnent qu’en une', () => {
    poser(e => {
      e.comptes.push(compte('c_n3', 'e_nova', 'pe', 'Atelier Nova shares 3',
        [ligne('l_n3', 'Atelier Nova shares 3', 5000)]));
    });
    const a = creerSociete('Atelier Nova');
    rattacherASociete([cleDe('c_n1', 'l_n1')], a);
    const b = creerSociete('Nova Atelier');
    rattacherASociete([cleDe('c_n2', 'l_n2'), cleDe('c_n3', 'l_n3')], b);
    const s = suggestionsRapprochement();
    eq(s.length, 1, 'les deux sociétés se proposent');
    const id = confirmerRapprochement(entite(`s:${a}`), entite(`s:${b}`), '');
    eq(id, a, 'la fusion garde la première');
    eq(societesDeclarees().length, 1, 'l’autre disparaît');
    eq(groupesSocietes()[0].participations.length, 3, 'avec toutes les participations');
    vrai(renommerSociete(a, 'Atelier Nova Group'), 'on la renomme');
    eq(societeParId(a).nom, 'Atelier Nova Group', 'sous son nouveau nom');
  });

  test('l’accueil et l’export gardent chaque participation', () => {
    poser();
    lier();
    const l = allocationByAsset();
    vrai(l.some(x => x.label === 'Atelier Nova shares') && l.some(x => x.label === 'Atelier Nova shares 2'),
      'sans parSociete, chaque ligne reste');
    const c = Store.state.comptes.find(k => k.id === 'c_n2');
    eq(c.lignes[0].libelle, 'Atelier Nova shares 2', 'la ligne garde son nom');
    eq(c.lignes[0].valeur, 25000, 'et sa valeur');
  });

  test('la migration est idempotente, et une sauvegarde garde tout', () => {
    poser(e => {
      /* Deux comptes qui portent le meme identifiant de ligne, une ligne sans
         identifiant, un lien vers une societe qui n'existe plus. */
      e.comptes.find(c => c.id === 'c_n2').lignes[0].id = 'l_n1';
      delete e.comptes.find(c => c.id === 'c_nl').lignes[0].id;
      e.comptes.find(c => c.id === 'c_n1').lignes[0].societeId = 'soc_disparue';
      e.societes = [{ id: 'soc_vide', nom: 'Sans personne' }];
    });
    Store.migrate();
    const cles = participations().map(p => p.cle);
    eq(new Set(cles).size, cles.length, 'chaque participation a sa propre clef');
    eq(Store.state.comptes.find(c => c.id === 'c_n2').lignes[0].id, 'l_n1',
      'un identifiant en double ne se renomme pas : le journal y renvoie');
    vrai(!Store.state.comptes.find(c => c.id === 'c_nl').lignes[0].id,
      'une ligne sans identifiant n’en reçoit pas : sa clef est à part');
    vrai(Store.state.comptes.filter(c => c.type === 'pe').every(c => c.lignes.every(l => l.cleSociete)),
      'chaque ligne de parts porte sa clef durable');
    vrai(!Store.state.comptes.find(c => c.id === 'c_n1').lignes[0].societeId, 'le lien orphelin part');
    eq(societesDeclarees().length, 0, 'la société sans participation aussi');
    /* Une societe d'une levee, et un refus qui compte : l'autre levee lui est
       proposee, et on repond « deux societes ». */
    const soc = creerSociete('Atelier Nova');
    rattacherASociete([cleDe('c_n1', 'l_n1')], soc);
    const autre = participations().find(p => p.compte.id === 'c_n2');
    eq(suggestionsRapprochement().length, 1, 'l’autre levée se propose');
    ecarterRapprochement(entite(`s:${soc}`), entite(`l:${autre.cle}`));
    eq(suggestionsRapprochement().length, 0, 'et se refuse');
    const avant = JSON.stringify(Store.state);
    Store.migrate();
    eq(JSON.stringify(Store.state.societes), JSON.stringify(JSON.parse(avant).societes),
      'rejouer la migration ne change aucune société');
    eq(JSON.stringify(Store.state.meta.rapprochementsEcartes),
      JSON.stringify(JSON.parse(avant).meta.rapprochementsEcartes), 'ni aucun refus');
    /* La sauvegarde est l'etat entier, et la restauration le repasse par la
       migration : societes, liens et refus doivent en revenir intacts. */
    Store.state = JSON.parse(avant);
    Store.migrate();
    refreshAccounts();
    eq(groupesSocietes().length, 1, 'la société revient');
    eq(groupesSocietes()[0].participations.length, 1, 'avec son lien');
    eq(suggestionsRapprochement().length, 0, 'et le refus tient toujours');
  });

  test('une cession totale annulée après un rechargement retrouve sa société', () => {
    poser();
    /* Une societe d'une seule participation : la ceder en entier ne laisse
       aucune ligne courante qui la designe, seulement la copie du journal. */
    const id = creerSociete('Atelier Nova');
    rattacherASociete([cleDe('c_n2', 'l_n2')], id);
    const a = cederPlacement({ compteId: 'c_n2', index: 0, produit: 26000, cashAccount: '', date: '2026-09-01' });
    vrai(a && a.totale, 'la cession est totale');
    Store.migrate(); refreshAccounts();
    vrai(societeParId(id), 'la société survit au rechargement : le journal la désigne encore');
    vrai(annulerVente(0), 'la cession s’annule');
    refreshAccounts();
    const g = groupesSocietes().find(x => x.id === id);
    vrai(g, 'la société a retrouvé sa participation');
    eq(g.participations.length, 1, 'celle qu’on venait de rendre');
  });

  test('une cession partielle d’avant la migration s’annule encore', () => {
    poser(e => {
      const l2 = e.comptes.find(c => c.id === 'c_n2').lignes[0];
      l2.id = 'l_n1';
      l2.parts = 100;
    });
    const a = cederPlacement({ compteId: 'c_n2', index: 0, parts: 40, produit: 10000, cashAccount: '', date: '2026-09-01' });
    vrai(a && !a.totale, 'la cession est partielle');
    Store.migrate(); refreshAccounts();
    eq(Store.state.comptes.find(c => c.id === 'c_n2').lignes[0].id, 'l_n1', 'l’identifiant reste celui du journal');
    eq(verifierAnnulation(0), null, 'et la cession s’annule encore');
  });

  test('supprimer une homonyme ne déplace pas un refus', () => {
    /* Deux lignes du meme identifiant dans un meme compte, et une troisieme
       ailleurs. Une clef tiree du rang ferait passer le refus de la deuxieme
       sur la premiere des que celle-ci disparait. */
    poser(e => {
      const c1 = e.comptes.find(c => c.id === 'c_n1');
      c1.lignes = [ligne('l_d', 'Atelier Nova shares', 30000), ligne('l_d', 'Atelier Nova shares 2', 25000)];
      e.comptes = e.comptes.filter(c => c.id !== 'c_n2');
      e.comptes.push(compte('c_n3', 'e_nova', 'pe', 'Atelier Nova shares 3',
        [ligne('l_n3', 'Atelier Nova shares 3', 5000)]));
    });
    eq(suggestionsRapprochement().length, 3, 'trois lignes, trois paires');
    ecarterRapprochement(entite(`l:${cleDe('c_n1', 'l_d', 1)}`), entite(`l:${cleDe('c_n3', 'l_n3')}`));
    eq(suggestionsRapprochement().length, 2, 'la paire refusée part');
    Store.state.comptes.find(c => c.id === 'c_n1').lignes.splice(0, 1);
    refreshAccounts();
    eq(suggestionsRapprochement().length, 0,
      'la première partie, le refus désigne toujours la deuxième et la troisième');
  });

  test('une fusion emporte aussi les participations du journal', () => {
    poser(e => {
      e.comptes.push(compte('c_n3', 'e_nova', 'pe', 'Atelier Nova shares 3',
        [ligne('l_n3', 'Atelier Nova shares 3', 5000)]));
    });
    const a = creerSociete('Atelier Nova');
    rattacherASociete([cleDe('c_n1', 'l_n1')], a);
    const b = creerSociete('Nova Atelier');
    rattacherASociete([cleDe('c_n2', 'l_n2'), cleDe('c_n3', 'l_n3')], b);
    /* La troisieme levee se cede en entier : sa copie au journal designe b. */
    vrai(cederPlacement({ compteId: 'c_n3', index: 0, produit: 5000, cashAccount: '', date: '2026-09-01' }),
      'la cession se fait');
    eq(confirmerRapprochement(entite(`s:${a}`), entite(`s:${b}`), ''), a, 'les deux sociétés fusionnent');
    eq(societeParId(b), null, 'l’absorbée disparaît, journal compris');
    vrai(annulerVente(0), 'la cession s’annule');
    refreshAccounts();
    eq(groupesSocietes().length, 1, 'une seule société');
    eq(groupesSocietes()[0].participations.length, 3, 'la levée rendue rejoint la société qui reste');
  });

  test('la page compte en brut, groupe par société et ouvre le détail au clavier', () => {
    const app = lireSource('assets/app.js') || '';
    const corps = nom => {
      const i = app.indexOf(`function ${nom}(`);
      return i < 0 ? '' : app.slice(i, app.indexOf('\n}\n', i) + 2);
    };
    vrai(/allocationByAsset\(\{ credits: false, financier: allocFinancier, parSociete: true \}\)/
      .test(corps('mountAllocation')), 'les barres groupent par société, en brut');
    vrai(/concentration\(\{ financier: allocFinancier \}\)/.test(corps('phraseConcentration')),
      'la phrase compte en brut');
    vrai(/baseAvoirsAlloc\(\)\.de/.test(corps('phraseConcentration')), 'et nomme la base des avoirs');
    const vue = app.slice(app.indexOf("trad('Par catégorie d’actif')"));
    vrai(/^[^]{0,900}mentionBase\(baseAvoirsAlloc\(\), valeurAvoirsAlloc\(\)\)/.test(vue),
      'les barres annoncent leur base sous leur titre');
    const bloc = corps('blocSocietes');
    vrai(/ligneListe\(\{\s*action: 'societe-detail'/.test(bloc),
      'une société s’ouvre par une ligne-bouton, que le clavier atteint');
    vrai(/data-action="societe-rapprocher"/.test(bloc) && /data-action="societe-ecarter"/.test(bloc),
      'une proposition porte ses deux réponses');
    for (const a of ['societe-detail', 'societe-rapprocher', 'societe-ecarter']) {
      vrai(app.includes(`'${a}'(`), `le geste ${a} existe`);
    }
  });
});

finDePartieDeTests('tests/27-societes-sous-jacentes.tests.js');
