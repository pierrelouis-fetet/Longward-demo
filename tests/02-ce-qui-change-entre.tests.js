partieDeTests('tests/02-ce-qui-change-entre.tests.js');
/* --- Ce qui a change entre deux releves : observe, jamais reconstruit ----- */
suite('Ce qui a changé entre deux relevés', () => {
  const app = () => lireSource('assets/app.js');
  const store = () => lireSource('assets/store.js');
  /* Deux releves ventiles par compte : la forme que l'enregistrement ecrit
     aujourd'hui. `v` ne sert qu'a dire que la ligne n'est pas vide. */
  const releve = (date, parts, dettes = 0) => ({
    date, comment: '', dettes, v: Object.fromEntries(Object.keys(parts).map(k => [k, 1])), parts,
  });
  const deuxReleves = s => {
    s.monthly = [
      releve('2026-07-01', { a: { cash: 5000, bourse: 20000 }, b: { pe: 3000 }, c: { immo: 150000 } }, 90000),
      releve('2026-08-01', { a: { cash: 4200, bourse: 22000 }, b: { pe: 5000 }, c: { immo: 150000 } }, 89500),
    ];
  };

  test('la somme des écarts de poches, moins l’écart de dette, fait l’écart de net', () => {
    Fixture.poser(deuxReleves);
    const v = derniereVariation();
    vrai(v, 'deux relevés se comparent');
    const somme = v.changesByPocket.reduce((s, x) => s + x.delta, 0) - v.debtChange;
    vrai(Math.abs(somme - v.totalChange) < 0.005, `${somme} = ${v.totalChange}`);
    eq(v.totalChange, rowNet(Store.state.monthly[1]) - rowNet(Store.state.monthly[0]),
      'et cet écart est celui du journal, de net à net');
    const par = Object.fromEntries(v.changesByPocket.map(x => [x.pocket, x]));
    eq(par.cash.delta, -800); eq(par.bourse.delta, 2000); eq(par.pe.delta, 2000);
    eq(par.bourse.previousValue, 20000); eq(par.bourse.currentValue, 22000);
    eq(v.debtChange, -500, 'l’encours baisse : un écart négatif');
  });

  test('une poche inchangée reste dite, une poche vide aux deux dates non', () => {
    Fixture.poser(deuxReleves);
    const par = Object.fromEntries(derniereVariation().changesByPocket.map(x => [x.pocket, x]));
    eq(par.immo.delta, 0, 'l’immobilier n’a pas bougé, et c’est une réponse');
    eq(par.crypto, undefined, 'aucune crypto, ni avant ni après');
  });

  test('le dernier relevé se compare au précédent, jamais à aujourd’hui', () => {
    /* La photo du jour range le cash d'un compte-titres autrement qu'un
       releve : la comparer ferait croire a un arbitrage. */
    Fixture.poser(deuxReleves);
    const v = derniereVariation();
    eq(v.jusqua, '2026-08-01', 'la borne haute est le dernier relevé');
    eq(v.depuis, '2026-07-01', 'la basse, celui d’avant');
    eq(v.index, 1, 'la carte ouvre la fiche de ce mois');
    Fixture.poser(s => { s.monthly = [s.monthly[0]]; });
    eq(derniereVariation(), null, 'un seul relevé : rien à comparer, la carte se tait');
  });

  test('le journal se montre à part, et n’entre dans aucun écart', () => {
    Fixture.poser(s => {
      deuxReleves(s);
      s.budget.apports = [
        { id: 'a1', libelle: 'Entrée dans l’intervalle', montant: 1000, date: '2026-07-20', note: '' },
        /* Le jour du releve d'avant est deja dans son solde. */
        { id: 'a2', libelle: 'Le jour du relevé d’avant', montant: 500, date: '2026-07-01', note: '' },
        { id: 'a3', libelle: 'Après le relevé', montant: 700, date: '2026-08-15', note: '' },
        { id: 'a4', libelle: 'Saisie en cours', montant: 0, date: '2026-07-25', note: '' },
      ];
    });
    const v = derniereVariation();
    eq(v.explicitEvents.length, 1, 'une seule ligne tombe dans l’intervalle');
    eq(v.explicitEvents[0].montant, 1000);
    const sans = (() => { Fixture.poser(deuxReleves); return derniereVariation(); })();
    eq(v.totalChange, sans.totalChange, 'l’écart ne change pas d’un euro : l’apport est déjà dans les soldes');
  });

  test('le moteur ne lit aucun flux, aucun prix de revient', () => {
    const src = store();
    const corps = src.slice(src.indexOf('function variationPatrimoine('), src.indexOf('function variationDuReleve('));
    vrai(corps.length > 200, 'le moteur est trouvable');
    const code = corps.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const interdit of ['posInvested', 'buyPrice', 'prixDeRevient', 'positions', 'nowTotals', 'patrimoine('])
      vrai(!code.includes(interdit), `${interdit} n’entre pas dans une différence de relevés`);
    /* Le journal des ventes n'y entre que pour ses sorties du perimetre : une
       vente creditee sur un compte suivi est un transfert de forme, pas un
       evenement du net. */
    vrai(/\.filter\(v => perimetreDeVente\(v\) === 'sortie'/.test(code),
      'seules les cessions sorties de Longward deviennent des événements');
    vrai(!/monthly\[i\]\.investi|\.investi\s*=/.test(src), 'aucun prix de revient historique n’est stocké');
  });

  test('la carte dit des écarts de valeur, jamais un gain', () => {
    const src = app();
    const vue = src.slice(src.indexOf('function listeVariation('), src.indexOf('function carteAccumulation()'));
    vrai(vue.includes('function carteVariation()'), 'la carte et sa liste sont dans la tranche');
    const textes = [...vue.matchAll(/trad\('([^']*)'/g)].map(m => m[1]);
    vrai(textes.length > 8, `${textes.length} textes lus`);
    for (const t of textes)
      vrai(!/gagn|rapport|investi|performance|Marchés|plus-value/i.test(t), `« ${t} » ne parle pas de gain`);
    /* Seul le total porte une couleur : une poche qui baisse n'est pas une
       faute, et l'application ne sait pas pourquoi elle baisse. */
    const colorees = vue.match(/class="\$\{cls\(([^)]*)\)/g) || [];
    vrai(colorees.length >= 1, 'le total est coloré');
    vrai(colorees.every(c => /cls\(v\.totalChange\)/.test(c)), 'et lui seul, dans la liste comme dans la carte');
  });

  test('la courbe et la carte partagent une grille, sur l’accueil seulement', () => {
    /* L'ordre de l'accueil est une donnee depuis qu'il se personnalise : la
       carte suit la courbe dans l'ordre par defaut, et la grille en deux tiers
       ne se pose que lorsque les deux se suivent vraiment a l'ecran. Rendue
       vide faute de second releve, la carte ne laisse pas de colonne. */
    const src = app();
    const corps = nom => src.slice(src.indexOf(nom), src.indexOf('\n}\n', src.indexOf(nom)));
    vrai(CARTES_APERCU.indexOf('changements') === CARTES_APERCU.indexOf('evolution') + 1, 'la carte suit la courbe');
    const rangees = corps('function rangeesApercu(');
    vrai(/a\.id === 'evolution' && b\.id === 'changements'/.test(rangees) && /class="grid g-2-1"/.test(rangees),
      'deux colonnes seulement quand les deux sont rendues côte à côte');
    vrai(/\.filter\(c => c\.html\.trim\(\)\)/.test(corps('function cartesApercu(')),
      'une carte vide ne compte pas comme voisine');
    eq((src.match(/=> carteVariation\(\)/g) || []).length, 1, 'un seul appel');
    vrai(/listeVariation\(variation, \{ avecTotal: false \}\)/.test(src),
      'la fiche du mois reprend la même liste, sans répéter son total');
  });

  test('la photo note le jour où elle a été prise', () => {
    const src = app();
    const f = src.slice(src.indexOf('function appliquerReleve('), src.indexOf('function appliquerReleve(') + 1600);
    vrai(/row\.clotureLe = todayISO\(\);/.test(f), 'clotureLe est écrit par le geste « Enregistrer »');
  });

  test('ce qui date se liste avant la photo, et le frais ne se liste pas', () => {
    Fixture.poser();
    const genres = aRafraichir().map(x => x.genre).sort();
    vrai(genres.includes('estimation'), 'un bien sans date d’estimation');
    vrai(genres.includes('credit'), 'un crédit jamais vérifié');
    vrai(genres.includes('cours'), 'des cours jamais actualisés');
    vrai(genres.includes('soldesSansDate'), 'des soldes jamais datés');
    Fixture.poser(s => {
      for (const c of s.comptes) for (const l of c.lignes) l.estimeLe = todayISO();
      for (const c of s.comptes) for (const e of c.cash) e.saisiLe = todayISO();
      for (const e of s.etabs) for (const d of e.dettes) d.verifieLe = todayISO();
      s.quotes = { lastRun: new Date().toISOString() };
    });
    eq(aRafraichir().length, 0, 'tout est frais : la liste est vide');
    Fixture.poser(s => { s.positions = []; });
    vrai(!aRafraichir().some(x => x.genre === 'cours'), 'sans titre coté, aucun cours à réclamer');
  });

  test('les seuils de fraîcheur n’ont qu’un propriétaire', () => {
    const src = store();
    eq((src.match(/const RAPPEL_CREDIT_MOIS = /g) || []).length, 1, 'un seul délai de rappel des crédits');
    eq((src.match(/const COURS_VIEUX_JOURS = /g) || []).length, 1, 'un seul âge des cours');
    vrai(/if \(days > COURS_VIEUX_JOURS\) add\('warn',/.test(src), 'la cloche lit le même seuil');
    vrai(/\$\{photo && revolu \? blocFraicheur\(\) : ''\}/.test(app()),
      'la liste se lit dans la fenêtre du relevé, avant le bouton de photo');
  });

  test('l’encours de crédit sur un an : observé de relevé à relevé', () => {
    const regle = REGLES_INSIGHT.find(r => r.id === 'debt_balance_shift');
    vrai(regle, 'la règle existe');
    const avec = (avant, apres, aujourdhui) => {
      Fixture.poser(s => {
        s.monthly = [releve('2025-08-01', { a: { cash: 1000 } }, avant),
                     releve('2026-08-01', { a: { cash: 1000 } }, apres)];
      });
      const m = { releves: historySeries({ includeNow: false }), aujourdhui };
      return regle.eligible(m) ? regle.evaluer(m) : null;
    };
    const r = avec(100000, 95000, '2026-09-24');
    vrai(r, 'cinq pour cent en un an se disent');
    eq(r.params.delta, -5000); eq(r.params.months, 12);
    eq(r.params.previous, 100000); eq(r.params.current, 95000);
    eq(r.evidence.source, 'historySeries', 'la preuve nomme les relevés');
    eq(avec(100000, 99500, '2026-09-24'), null, 'un demi-point est le bruit des dates');
    eq(avec(100000, 95000, '2027-03-01'), null, 'un dernier relevé vieux de sept mois ne parle plus');
    eq(avec(0, 200000, '2026-09-24'), null, 'un crédit qui naît n’a pas de base');
    vrai(avec(90000, 110000, '2026-09-24').params.delta > 0, 'une hausse se dit aussi');
  });
});

/* --- Une cession, quel que soit l'actif : forme, pas valeur -------------- */
suite('Une seule logique de cession', () => {
  const app = () => lireSource('assets/app.js');
  const net = () => round2(patrimoine().net);
  const cashDe = id => round2(cashCompte(compteById(id)));
  /* Un fixture enrichi : une ligne cotee sur le CTO, un compte de parts de
     societe, un portefeuille crypto qui garde des euros et un autre qui n'en
     garde pas, et une assurance-vie sans poche de liquidites. */
  const poser = (modifier) => Fixture.poser(s => {
    s.positions.push({ id: 'p_a', name: 'Titre A', isin: '', symbol: 'TA', currency: 'EUR', qty: 10,
                       buyPrice: 150, price: 200, fx: 1, fxBuy: 1, account: 'c_cto', manual: false,
                       assetClass: 'actions', role: 'satellite' });
    s.comptes.push(
      { id: 'c_soc', etabId: 'e_pe', type: 'pe', statut: 'ouvert', ouvertLe: '2020-01-01', numero: '', notes: '',
        libelle: 'Société fictive', court: 'Société', alloc: '', cash: [],
        lignes: [{ id: 'l_soc', classe: 'nonCote', libelle: 'Société fictive', valeur: 15000,
                   prixDeRevient: 5000, parts: 4200, quantite: 1, dateAcquisition: '', estimeLe: todayISO() }] },
      { id: 'c_cry', etabId: 'e_courtier', type: 'crypto', statut: 'ouvert', ouvertLe: '2022-01-01', numero: '',
        notes: '', libelle: 'Crypto', court: 'Crypto', alloc: '', cash: [{ montant: 0, affectation: 'investir' }], lignes: [] },
      { id: 'c_cry2', etabId: 'e_courtier', type: 'crypto', statut: 'ouvert', ouvertLe: '2022-01-01', numero: '',
        notes: '', libelle: 'Crypto sans euros', court: 'Crypto 2', alloc: '', cash: [], lignes: [] },
      { id: 'c_av', etabId: 'e_banque', type: 'av', statut: 'ouvert', ouvertLe: '2019-01-01', numero: '',
        notes: '', libelle: 'Contrat', court: 'Contrat', alloc: '', cash: [], lignes: [] });
    s.positions.push({ id: 'p_btc', name: 'Jeton', isin: '', symbol: 'JT', currency: 'EUR', qty: 0.5,
                       buyPrice: 40000, price: 60000, fx: 1, fxBuy: 1, account: 'c_cry', manual: false,
                       assetClass: 'crypto', role: 'satellite' });
    if (modifier) modifier(s);
  });
  const indexDe = id => Store.state.positions.findIndex(p => p.id === id);

  test('les destinations éligibles sont de vrais soldes de liquidités', () => {
    poser();
    const ids = cashTargets().map(c => c.id);
    for (const id of ['c_courant', 'c_livret', 'c_pea', 'c_cto', 'c_cry'])
      vrai(ids.includes(id), `${id} peut recevoir un produit`);
    for (const id of ['c_soc', 'c_immo', 'c_pe', 'c_av', 'c_cry2'])
      vrai(!ids.includes(id), `${id} n’a pas de poche de liquidités`);
    eq(destinationAuto('c_cto'), 'c_cto', 'un compte-titres garde le produit de ses ventes');
    eq(destinationAuto('c_cry'), 'c_cry', 'un portefeuille crypto qui garde des euros aussi');
    eq(destinationAuto('c_cry2'), null, 'sans euros, la destination se choisit');
    eq(destinationAuto('c_soc'), null, 'des parts de société n’ont pas de cash à elles');
    eq(defaultCashTarget('c_soc'), 'c_courant', 'le compte courant est proposé par défaut');
  });

  test('cas 1 : une action vendue sur un CTO, le patrimoine ne bouge pas', () => {
    poser();
    const avant = net(), cash = cashDe('c_cto');
    const a = sellPosition({ index: indexDe('p_a'), qty: 10, price: 200, fxSell: 1,
                             cashAccount: destinationAuto('c_cto'), cashPart: partieSuggeree(destinationAuto('c_cto'), { credit: true }), date: '2026-09-01' });
    vrai(a, 'la vente passe');
    eq(cashDe('c_cto'), round2(cash + 2000), 'le cash du CTO reçoit le produit');
    eq(indexDe('p_a'), -1, 'la ligne vendue en entier disparaît');
    eq(net(), avant, 'transfert de forme : le net n’a pas bougé');
    const v = Store.state.sales[0];
    eq(v.destination, 'auto'); eq(v.perimetre, 'interne');
    eq(v.realised, 500, 'la plus-value réalisée'); eq(v.sortie, 2000, 'la valeur retirée');
    eq(v.actifId, 'p_a'); eq(v.typeActif, 'titre');
  });

  test('cas 2 : des parts de société cédées vers le compte courant', () => {
    poser();
    const avant = net(), cash = cashDe('c_courant');
    const a = cederPlacement({ compteId: 'c_soc', index: 0, parts: 4200, produit: 15000,
                               cashAccount: 'c_courant', cashPart: partieSuggeree('c_courant', { credit: true }), date: '2026-09-01' });
    vrai(a, 'la cession passe');
    eq(cashDe('c_courant'), round2(cash + 15000), 'le compte courant est alimenté');
    eq((compteById('c_soc').cash || []).length, 0, 'aucune poche de cash n’est fabriquée dans le compte de parts');
    eq(net(), avant, 'transfert de forme : le net n’a pas bougé');
    const v = Store.state.sales[0];
    eq(v.destination, 'choisie'); eq(v.perimetre, 'interne'); eq(v.realised, 10000);
  });

  test('cas 3 : le produit sort de Longward, le patrimoine suivi baisse', () => {
    poser();
    const avant = net();
    const cashes = cashTargets().map(c => cashDe(c.id));
    cederPlacement({ compteId: 'c_soc', index: 0, parts: 4200, produit: 15000, cashAccount: '', date: '2026-09-01' });
    eq(net(), round2(avant - 15000), 'une sortie du périmètre, pas une perte');
    eq(JSON.stringify(cashTargets().map(c => cashDe(c.id))), JSON.stringify(cashes), 'aucun cash n’est créé');
    const v = Store.state.sales[0];
    eq(v.destination, 'hors'); eq(v.perimetre, 'sortie'); eq(v.realised, 10000, 'la plus-value reste dite');
    const ann = annulerVente(0);
    vrai(ann, 'l’annulation passe');
    eq(net(), avant, 'et rend la ligne sans débiter un cash jamais crédité');
  });

  test('cas 4 : 1000 parts sur 4200, tout reste exact', () => {
    poser();
    const cash = cashDe('c_courant');
    const a = cederPlacement({ compteId: 'c_soc', index: 0, parts: 1000, produit: 3500,
                               cashAccount: 'c_courant', cashPart: partieSuggeree('c_courant', { credit: true }), date: '2026-09-01' });
    const l = compteById('c_soc').lignes[0];
    eq(l.parts, 3200, 'les parts restantes');
    eq(a.investi, round2(5000 * 1000 / 4200), 'le coût des parts cédées, au prorata');
    eq(a.investi, 1190.48, 'soit 1 190,48 €, arrondi au centime');
    eq(round2(a.investi + num(l.prixDeRevient)), 5000, 'et celui des parts restantes complète au centime');
    eq(a.realised, round2(3500 - a.investi), 'la plus-value réalisée sur les seules parts cédées');
    eq(l.valeur, round2(15000 * 3200 / 4200), 'la valeur restante, au prorata');
    eq(l.valeur, 11428.57, 'soit 11 428,57 €');
    eq(cashDe('c_courant'), round2(cash + 3500), 'le cash exact');
  });

  test('cas 5 : une crypto vendue garde ses euros chez l’exchange, au satoshi près', () => {
    poser();
    const avant = net();
    sellPosition({ index: indexDe('p_btc'), qty: 0.123, price: 60000, fxSell: 1,
                   cashAccount: destinationAuto('c_cry'), cashPart: partieSuggeree(destinationAuto('c_cry'), { credit: true }), date: '2026-09-01' });
    eq(Store.state.positions[indexDe('p_btc')].qty, 0.377, 'la quantité restante garde ses décimales');
    eq(cashDe('c_cry'), 7380, 'le cash de l’exchange');
    eq(net(), avant, 'le net n’a pas bougé');
  });

  test('cas 6 : vendre puis réinvestir ne fait ni variation ni apport', () => {
    poser();
    const avant = net();
    sellPosition({ index: indexDe('p_a'), qty: 10, price: 200, fxSell: 1, cashAccount: 'c_cto', cashPart: partieSuggeree('c_cto', { credit: true }), date: '2026-09-01' });
    /* Le rachat : une ligne qui entre, le meme cash qui sort. */
    Store.state.positions.push({ id: 'p_b', name: 'Titre B', isin: '', symbol: 'TB', currency: 'EUR', qty: 20,
                                 buyPrice: 100, price: 100, fx: 1, fxBuy: 1, account: 'c_cto', manual: false,
                                 assetClass: 'actions', role: 'core' });
    mouvementCash('c_cto', -2000, partieSuggeree('c_cto'));
    eq(net(), avant, 'aucune variation');
    eq((Store.state.budget.apports || []).length, 0, 'aucun apport externe');
    eq(perimetreDeVente(Store.state.sales[0]), 'interne', 'la vente est un transfert interne');
  });

  test('une plus-value réalisée ne s’ajoute pas une seconde fois', () => {
    /* Valeur 15 000, cout 5 000 : la latente est deja dans le net. */
    poser();
    const avant = net();
    cederPlacement({ compteId: 'c_soc', index: 0, parts: 4200, produit: 15000, cashAccount: 'c_courant', cashPart: partieSuggeree('c_courant', { credit: true }), date: '2026-09-01' });
    eq(net(), avant, 'le net ne gagne pas les 10 000 € réalisés');
    eq(Store.state.sales[0].realised, 10000, 'ils sont réalisés, et dits au journal');
  });

  test('les anciennes lignes du journal se lisent sans être réécrites', () => {
    eq(perimetreDeVente({ cashAccount: 'c_cto', account: 'c_cto' }), 'interne');
    eq(destinationDeVente({ cashAccount: 'c_cto', account: 'c_cto' }), 'auto');
    eq(destinationDeVente({ cashAccount: 'c_courant', account: 'c_cto' }), 'choisie');
    eq(perimetreDeVente({ cashAccount: '' }), 'sortie');
    eq(perimetreDeVente({ declaree: true }), 'memoire', 'une vente pour mémoire n’a rien déplacé');
  });

  test('une sortie du périmètre devient un événement de « Ce qui a changé »', () => {
    poser(s => {
      s.monthly = [{ date: '2026-08-01', comment: '', dettes: 0, v: { c_courant: 3000 } },
                   { date: '2026-09-01', comment: '', dettes: 0, v: { c_courant: 3000 } }];
    });
    cederPlacement({ compteId: 'c_soc', index: 0, parts: 4200, produit: 15000, cashAccount: '', date: '2026-08-20' });
    sellPosition({ index: indexDe('p_a'), qty: 10, price: 200, fxSell: 1, cashAccount: 'c_cto', cashPart: partieSuggeree('c_cto', { credit: true }), date: '2026-08-21' });
    const ev = derniereVariation().explicitEvents;
    eq(ev.length, 1, 'la vente créditée n’en est pas un');
    eq(ev[0].genre, 'sortie'); eq(ev[0].montant, -15000, 'la valeur sortie du patrimoine');
  });

  test('une seule écriture de cash, et une seule destination dans les fenêtres', () => {
    const st = lireSource('assets/store.js').replace(/\/\*[\s\S]*?\*\//g, '');
    eq((st.match(/cashInvestirEntree\(c, true\)/g) || []).length, 1,
      'la migration seule pose une part : un mouvement d’espèces n’en crée jamais');
    const src = app();
    eq((src.match(/\$\{champDestination\('(ce|ve)'/g) || []).length + (src.match(/champDestination\('ve', p\.account\)/g) || []).length, 2,
      'la cession et la vente montrent la même destination');
    vrai(!/Ne rien créditer/.test(src), 'plus de « Ne rien créditer » : la case dit ce qu’elle fait');
    vrai(/\.\.\.destinationDe\(lireDestination\('ce'\)\)/.test(src) && /\.\.\.destinationDe\(lireDestination\('ve'\)\)/.test(src),
      'les deux fenêtres lisent la destination par la même porte');
    /* La regle generique des champs met tout input a pleine largeur : sans ce
       correctif, la case poussait son libelle hors de la fenetre. */
    vrai(/\.field-case > input \{ flex: none; width: auto;/.test(lireSource('assets/styles.css')),
      'la case à cocher garde sa taille de case');
  });
});

/* --- Un en-tete de carte porte un titre et une chose au plus -------------- */
suite('Une seule grammaire d’en-tête de carte', () => {
  const app = () => lireSource('assets/app.js');
  const entre = (s, a, b) => { const i = s.indexOf(a); return i < 0 ? '' : s.slice(i, s.indexOf(b, i)); };
  const tete = bloc => entre(bloc, '<div class="card-head">', '<div class="carte-filtres">');

  test('les lignes de titres : le titre et Ajouter, puis les filtres, puis le compte et le tri', () => {
    const carte = entre(app(), '<div class="card" data-anchor="titres">', '<div class="liste-mobile">');
    vrai(carte.length > 500, 'la carte est trouvable');
    const t = tete(carte).replace(/<!--[\s\S]*?-->/g, '');
    eq((t.match(/<button/g) || []).length, 1, 'un seul bouton dans l’en-tête');
    vrai(/data-action="ajouter-ligne"/.test(t) && /trad\('\+ Ajouter'\)/.test(t), 'et c’est Ajouter');
    vrai(!/sell-position/.test(carte), 'Vendre a quitté l’en-tête : il vit dans la fiche et dans le journal');
    const iF = carte.indexOf('<div class="carte-filtres">'), iM = carte.indexOf('<div class="carte-meta">');
    vrai(iF > 0 && iM > iF, 'les filtres, puis le compte et le tri');
    const filtres = carte.slice(iF, iM);
    vrai(/\$\{filtresLignes\(\)\}/.test(filtres), 'rôle et compte au deuxième niveau');
    const ctl = entre(app(), 'function filtresLignes()', 'const compteLignes');
    vrai(/filtrer-role/.test(ctl) && /filtrer-compte-titres/.test(ctl), 'et ce sont bien ces deux filtres');
    vrai(/trier-positions/.test(carte.slice(iM)), 'le tri au troisième, avec le compte des lignes');
    vrai(!/Une ligne s’ouvre au doigt/.test(carte), 'plus de phrase pour dire qu’une ligne s’ouvre');
  });

  test('les filtres des lignes se posent une fois, et le jour couvre tout le portefeuille', () => {
    /* Le jour ne filtre ni ne trie a part : son total porte sur tout le
       portefeuille, sa liste aussi. Les filtres ne vivent que sur les lignes. */
    const src = app();
    eq((src.match(/\$\{filtresLignes\(\)\}/g) || []).length, 1, 'les contrôles des lignes, posés une seule fois');
    const f = src.slice(src.indexOf('function sectionJour()'), src.indexOf('\n}\n', src.indexOf('function sectionJour()')));
    vrai(f.length > 500, 'la section du jour est trouvable');
    vrai(!/passeFiltresLignes|filtresLignes|triJourBouton|jourSort/.test(f), 'le jour ne filtre ni ne trie à part');
    vrai(/\.filter\(\(\{ p \}\) => passeFiltresLignes\(p\)\)/.test(src), 'les lignes de titres gardent leur filtre');
  });

  test('le journal des ventes suit la même grammaire', () => {
    const carte = entre(app(), '<div class="card" data-anchor="ventes">', '<p class="empty">');
    const t = entre(carte, '<div class="card-head">', '</div>').replace(/<!--[\s\S]*?-->/g, '');
    eq((t.match(/<button/g) || []).length, 1, 'une seule action dans l’en-tête');
    vrai(!/rangeControl|class="hint"/.test(t), 'ni les périodes ni le compte sur la ligne du titre');
    /* Les periodes ont quitte la carte : elles bornent aussi les deux graphiques,
       et vivent dans la barre « Periode des ventes », au-dessus de la premiere
       carte de ventes visible. */
    vrai(/<div class="carte-filtres">\$\{selecteurAnneeTransactions\(\)\}<\/div>/.test(app()), 'les périodes au deuxième niveau, dans leur barre');
  });

  test('une précision qui accompagne une action se range sous le titre', () => {
    const charges = entre(app(), '<div class="card" data-anchor="charges">', "${(() => {");
    vrai(/<div class="tete-titre">\s*<h2>\$\{trad\('Charges fixes'\)\}<\/h2>/.test(charges), 'le total des charges sous leur titre');
    vrai(/<\/div>\s*<button class="btn sm ghost" data-action="add-charge">/.test(charges), 'et le bouton seul à droite');
    const entrees = entre(app(), "<h2>${trad('Entrées et sorties exceptionnelles')}</h2>", "${!liste.length && !tout.length");
    vrai(/<div class="carte-filtres">\$\{yearControl\('history-year', annees, annee\)\}<\/div>/.test(entrees),
      'le sélecteur d’année sous l’en-tête du journal des entrées');
  });

  test('le bouton d’une carte ne grandit pas son en-tête, et les rangées sont partagées', () => {
    const css = lireSource('assets/styles.css');
    vrai(/\.card-head > \.btn\.sm \{ margin-block: -4px; \}/.test(css), 'même hauteur avec ou sans bouton');
    eq((css.match(/^\.carte-filtres \{/gm) || []).length, 1, 'une seule définition des filtres');
    eq((css.match(/^\.carte-meta \{/gm) || []).length, 1, 'une seule définition du compte et du tri');
  });
});

/* --- Le total des lignes de titres suit leurs filtres ------------------- */
suite('Le total des lignes de titres suit leurs filtres', () => {
  /* Deux comptes, deux roles, deux lignes sans prix de revient dont une
     manuelle. Les chiffres sont choisis pour se verifier de tete. */
  const LIGNES = () => [
    { name: 'A1', account: 'cA', role: 'core',      qty: 10, price: 100, buyPrice: 80 },
    { name: 'A2', account: 'cA', role: 'satellite', qty: 5,  price: 40,  buyPrice: 50 },
    { name: 'A3', account: 'cA', role: 'satellite', qty: 4,  price: 25,  buyPrice: 0 },
    { name: 'B1', account: 'cB', role: 'core',      qty: 2,  price: 300, buyPrice: 250 },
    { name: 'B2', account: 'cB', role: 'core',      manual: true, value: 400, invested: 0 },
  ].map(p => ({ currency: deviseBase(), fx: 1, ...p }));
  /* role, compte, noms retenus, valeur, investi, perf, pourcentage, lignes
     sans base, valeur de ces lignes */
  const ATTENDU = [
    ['tous', 'tous', 'A1 A2 A3 B1 B2', 2300, 1550, 250, 250 / 1550 * 100, 2, 500],
    ['tous', 'cA',   'A1 A2 A3',       1300, 1050, 150, 150 / 1050 * 100, 1, 100],
    ['tous', 'cB',   'B1 B2',          1000,  500, 100, 20,               1, 400],
    ['core', 'tous', 'A1 B1 B2',       2000, 1300, 300, 300 / 1300 * 100, 1, 400],
    ['satellite', 'tous', 'A2 A3',      300,  250, -50, -20,              1, 100],
    ['core', 'cA',   'A1',             1000,  800, 200, 25,               0, 0],
    ['satellite', 'cA', 'A2 A3',        300,  250, -50, -20,              1, 100],
    ['core', 'cB',   'B1 B2',          1000,  500, 100, 20,               1, 400],
    ['satellite', 'cB', '',               0,    0,   0, null,             0, 0],
  ];

  test('chaque combinaison de filtres totalise exactement ses lignes', () => {
    Fixture.poser();
    const lignes = LIGNES();
    for (const [role, compte, noms, valeur, investi, perf, pct, sansBase, valSans] of ATTENDU) {
      const quoi = `${role} / ${compte}`;
      const vues = lignes.filter(p => passeFiltresTitres(p, role, compte));
      eq(vues.map(p => p.name).join(' '), noms, `${quoi} : les lignes retenues`);
      const t = latentPnl(vues);
      eq(t.count, vues.length, `${quoi} : le compte des lignes`);
      pres(t.value, valeur, `${quoi} : la valeur`);
      pres(t.invested, investi, `${quoi} : l’investi`);
      pres(t.pnl, perf, `${quoi} : la perf`);
      if (pct == null) eq(t.pct, null, `${quoi} : pas de base, pas de pourcentage`);
      else pres(t.pct, pct, `${quoi} : le pourcentage`);
      eq(t.sansBase, sansBase, `${quoi} : les lignes sans prix de revient`);
      pres(t.valeurSansBase, valSans, `${quoi} : leur valeur`);
      /* Un total vaut la somme de ses parts, colonne par colonne. */
      pres(t.value, vues.reduce((s, p) => s + posValue(p), 0), `${quoi} : somme des valeurs`);
      pres(t.invested, vues.reduce((s, p) => s + posInvested(p), 0), `${quoi} : somme des investis`);
      pres(t.pnl, vues.reduce((s, p) => s + (posPerfEur(p) ?? 0), 0), `${quoi} : somme des perfs affichées`);
      /* Et l'ecart entre valeur moins investi et perf est ce que la note chiffre. */
      pres(t.value - t.invested - t.pnl, t.valeurSansBase, `${quoi} : l’écart se retrouve`);
    }
  });

  test('une ligne seule sans prix de revient ne donne ni perf ni pourcentage', () => {
    Fixture.poser();
    const a3 = LIGNES().find(p => p.name === 'A3');
    const t = latentPnl([a3]);
    pres(t.value, 100, 'sa valeur compte');
    pres(t.invested, 0, 'aucun investi connu');
    eq(t.avecBase, 0, 'aucune base');
    eq(t.pct, null, 'aucun pourcentage');
    pres(t.pnl, 0, 'le calcul rend zéro, et c’est à l’écran de se taire');
    const src = lireSource('assets/app.js');
    const pied = src.slice(src.indexOf("${!ps.length ? '' : `<tfoot>"), src.indexOf('</tfoot>`}'));
    vrai(pied.length > 100, 'le pied des lignes de titres est trouvable');
    vrai(/\$\{vus\.avecBase \? fmtSigned\(vus\.pnl\) : ''\}/.test(pied), 'la perf se tait sans base');
    vrai(/\$\{vus\.pct == null \? '' : fmtSignedPct\(vus\.pct\)\}/.test(pied), 'le pourcentage aussi');
    vrai(/\$\{notePiedTitres\(vus\)\}/.test(pied), 'et une note dit pourquoi');
    const note = src.slice(src.indexOf('function notePiedTitres('), src.indexOf('const POS_SORT_KEYS'));
    vrai(/if \(!t\.sansBase\) return '';/.test(note), 'sans ligne manquante, aucune note');
    vrai(/fmtEUR\(t\.valeurSansBase\)/.test(note), 'la note chiffre ce que la perf laisse de côté');
  });

  test('sans argument, le calcul reste celui de tout le portefeuille', () => {
    Fixture.poser();
    const a = latentPnl(), b = latentPnl(Store.state.positions), c = portfolioPnl();
    for (const cle of ['value', 'invested', 'pnl', 'count', 'sansBase'])
      eq(a[cle], b[cle], `${cle} : la liste par défaut est tout le portefeuille`);
    eq(c.value, a.value, 'et le nom historique lit la même chose');
    vrai(!passeFiltresTitres(null), 'une ligne absente ne passe aucun filtre');
    vrai(passeFiltresTitres({ account: 'x', role: 'core' }), 'sans filtre, tout passe');
  });

  test('la carte lit ses lignes, la carte du haut garde tout le portefeuille', () => {
    const src = lireSource('assets/app.js');
    vrai(/const passeFiltresLignes = p => passeFiltresTitres\(p, posRole, posCompte\);/.test(src),
      'la vue filtre par la règle du modèle, celle que ces tests font tourner');
    const vue = src.slice(src.indexOf('function viewPositions('), src.indexOf('function mountPositions('));
    vrai(/const pnl = portfolioPnl\(\);/.test(vue) && /<p class="ptf-total">\$\{fmtEUR\(st\.balance\)\}<\/p>/.test(vue),
      'la carte Portefeuille garde sa valeur, cash compris');
    vrai(/const vus = latentPnl\(ps\);/.test(vue), 'le total des lignes part de la liste filtrée');
    const carte = vue.slice(vue.indexOf('<div class="card" data-anchor="titres">'), vue.indexOf('id="reperesFamilles"'));
    vrai(carte.length > 1000, 'la carte des lignes de titres est trouvable');
    vrai(!/\bpnl\./.test(carte), 'aucun chiffre du portefeuille entier dans la carte des lignes');
    const iM = carte.indexOf('<div class="carte-meta">');
    const iT = carte.indexOf('<p class="total-vus">');
    vrai(iM > 0 && iT > iM && iT < carte.indexOf('<div class="liste-mobile">'),
      'le sous-total vient juste sous le compte des lignes');
    vrai(/\$\{!ps\.length \? '' : `<p class="total-vus">/.test(carte), 'et ne se pose pas sans ligne');
    vrai(/<b>\$\{fmtEUR\(vus\.value\)\}<\/b>/.test(carte), 'le montant est celui des lignes affichées');
    vrai(/<td>\$\{fmtEUR\(vus\.value\)\}<\/td><td>\$\{fmtEUR\(vus\.invested\)\}<\/td>/.test(carte),
      'le pied du tableau aussi');
    eq((carte.match(/\$\{libelleVus\}/g) || []).length, 2, 'un seul intitulé, posé sur les deux surfaces');
    vrai(/trad\('Total des positions affichées'\)/.test(vue), 'l’intitulé dit des positions, pas un compte');
    for (const k of ['Total des positions affichées',
      'La somme des lignes affichées, filtres compris. Le cash de tes comptes n’y est pas : ce n’est pas la valeur d’un compte.',
      'Aucune de ces lignes n’a de prix de revient : pas de perf à calculer.',
      'Cette ligne n’a pas de prix de revient : pas de perf à calculer.',
      'La perf ne compte pas {n} lignes sans prix de revient, qui valent {v}.',
      'La perf ne compte pas {n} ligne sans prix de revient, qui vaut {v}.'])
      vrai(I18N.en[k], `traduit : ${k}`);
    const css = lireSource('assets/styles.css');
    vrai(/\n\.total-vus \{ display: none; \}/.test(css), 'le sous-total ne vit pas sur grand écran, le pied le porte');
    const mob = css.slice(css.indexOf('.total-vus { display: none; }'));
    vrai(/@media \(max-width: 767px\) \{\s*\.total-vus \{\s*display: flex;/.test(mob), 'il vit sur téléphone');
  });
});

/* --- L'objectif avance depuis son point de depart, pas depuis zero -------- */
suite('L’objectif avance depuis son point de départ', () => {
  const d = (valeur, date = '2026-09-25') => ({ date, valeur, source: 'creation' });

  test('la barre part de zéro le jour où l’objectif naît', () => {
    const cas = (total, attendu) => {
      const p = progressionObjectif({ total, obj: 30000, remaining: total - 30000 }, d(28000.5));
      pres(p.pct, attendu, `à ${total}`);
      return p;
    };
    eq(cas(28000.5, 0).etat, 'enCours', 'au départ, rien n’est parcouru');
    pres(cas(28000.5, 0).barre, 0, 'et la barre est vide');
    /* Le depart est arrondi au centime, le patrimoine du jour non : le jour de
       la creation, un ecart flottant ne doit pas passer pour une baisse. */
    eq(cas(28000.5 - 1e-9, 0).etat, 'enCours', 'un bruit de virgule flottante n’est pas une baisse');
    cas(29000.25, 50);
    eq(cas(30000, 100).etat, 'atteint', 'à la cible, le chemin est fait');
  });

  test('une baisse, une cible dépassée, une cible atteinte dès le départ', () => {
    const baisse = progressionObjectif({ total: 27000, obj: 30000, remaining: -3000 }, d(28000));
    eq(baisse.etat, 'enBaisse', 'sous le départ');
    pres(baisse.pct, -50, 'le chiffre dit le recul, sans se borner');
    pres(baisse.barre, 0, 'la barre, elle, reste à zéro');
    const depasse = progressionObjectif({ total: 31000, obj: 30000, remaining: 1000 }, d(28000));
    eq(depasse.etat, 'atteint', 'au-delà de la cible');
    pres(depasse.pct, 150, 'le dépassement se compte');
    pres(depasse.barre, 100, 'et la barre est pleine, pas plus');
    const deja = progressionObjectif({ total: 33000, obj: 30000, remaining: 3000 }, d(32000));
    eq(deja.etat, 'atteinteAuDepart', 'une cible sous le départ n’a pas de chemin');
    eq(deja.pct, null, 'et pas de pourcentage : le diviseur serait négatif');
    eq(progressionObjectif({ total: 28000, obj: 30000, remaining: -2000 }, null).etat, 'inconnu',
      'sans départ, rien ne se mesure');
    eq(progressionObjectif({ total: 50000, obj: 0, remaining: 50000 }, d(1)).etat, 'sansCible', 'sans cible non plus');
  });

  test('créer fige le départ, modifier la cible le garde, la retirer l’efface', () => {
    Fixture.poser(s => { s.meta.objective = 0; });
    const net = nowTotals().total;
    suivreCibleObjectif(0, 120000, '2026-09-25');
    const cree = departObjectif();
    eq(cree.date, '2026-09-25', 'la date du jour de création');
    pres(cree.valeur, net, 'et le patrimoine net de ce jour, sans le remettre à zéro');
    eq(cree.source, 'creation', 'la source le dit');
    pres(progressionObjectif({ ...objectiveStatus(), obj: 120000 }).pct, 0, 'la barre commence à 0 %');
    suivreCibleObjectif(120000, 150000, '2026-12-01');
    eq(JSON.stringify(departObjectif()), JSON.stringify(cree), 'changer la cible ne redéfinit rien');
    Store.state.meta.objectiveYear = 2030;
    eq(JSON.stringify(departObjectif()), JSON.stringify(cree), 'changer l’année non plus');
    suivreCibleObjectif(150000, 0);
    eq(departObjectif(), null, 'retirer la cible retire l’objectif et son départ');
  });

  test('un objectif sans départ n’en reçoit pas un inventé', () => {
    Fixture.poser(s => { s.meta.objective = 200000; delete s.meta.objectifDepart; });
    eq(departObjectif(), null, 'aucun départ supposé, ni zéro ni le 1er janvier');
    eq(progressionObjectif().etat, 'inconnu', 'la barre attend');
    Store.state.meta.objectifDepart = { date: '2026-13-40', valeur: 'x' };
    eq(departObjectif(), null, 'un départ illisible ne vaut pas mieux');
  });

  test('un départ passé se prend sur un relevé, à la date de sa photo et pour son net', () => {
    Fixture.poser(s => {
      s.monthly.push({ date: '2026-03-01', clotureLe: '2026-03-02', comment: '', v: { c_courant: 3000, c_livret: 2000 }, dettes: 500 });
      s.monthly.push({ date: '2026-05-01', comment: '', v: {} });
      s.monthly.push({ date: '2099-01-01', comment: '', v: { c_courant: 1 } });
    });
    const avant = JSON.stringify(Store.state.monthly);
    const p = departsPossibles('2026-09-25');
    eq(p[0].source, 'jour', 'aujourd’hui d’abord');
    pres(p[0].valeur, nowTotals().total, 'pour le patrimoine du jour');
    const mars = p.find(x => x.releve === '2026-03-01');
    vrai(mars, 'le relevé de mars est un départ possible');
    eq(mars.date, '2026-03-02', 'à la date où sa photo a été prise');
    pres(mars.valeur, 4500, 'pour son patrimoine net, dettes déduites');
    vrai(!p.some(x => x.releve === '2026-05-01'), 'un relevé vide ne dit rien du patrimoine');
    vrai(!p.some(x => x.releve === '2099-01-01'), 'un relevé à venir n’est pas un départ');
    vrai(!p.some(x => /-01-01$/.test(x.date) && !x.releve), 'aucun 1er janvier supposé');
    eq(JSON.stringify(Store.state.monthly), avant, 'et les relevés ne sont pas touchés');
  });

  test('le reste et le rythme ne changent pas, la carte lit l’avancement', () => {
    Fixture.poser(s => { s.meta.objective = 120000; s.meta.objectiveYear = new Date().getFullYear() + 1; });
    const g = objectiveStatus();
    eq(g.pct, undefined, 'le pourcentage depuis zéro n’existe plus');
    pres(g.remaining, g.total - 120000, 'ce qui manque reste l’écart à la cible');
    const pj = objectiveProjection();
    pres(pj.needed, pj.monthsLeft ? (120000 - g.total) / pj.monthsLeft : 0, 'et le rythme nécessaire le même calcul');
    const src = lireSource('assets/app.js');
    vrai(!/\bg\.pct\b/.test(src), 'plus aucun écran ne lit l’ancien pourcentage');
    const carte = src.slice(src.indexOf('const carteObjectif = () => {'), src.indexOf('const ageDetaille'));
    vrai(/const p = progressionObjectif\(g\);/.test(carte), 'la carte lit l’avancement depuis le départ');
    vrai(/\$\{p\.pct == null \? '' : `<div class="goal-bar">/.test(carte), 'sans chemin mesurable, pas de barre');
    vrai(/trad\('Départ'\)/.test(carte), 'et le départ se lit sur la carte');
    vrai(/if \(path === 'meta\.objective'\) suivreCibleObjectif\(avant, getPath\(path\)\);/.test(src),
      'une cible saisie passe par le suivi du départ');
    vrai(/async 'objectif-depart'\(\)/.test(src) && /departsPossibles\(\)/.test(src),
      'et le départ se choisit par un geste, parmi aujourd’hui et les relevés');
    for (const k of ['point de départ à définir', 'cible déjà atteinte au départ', 'sous le point de départ',
      'du chemin parcouru', 'Choisis un point de départ pour suivre l’avancement.', 'Point de départ'])
      vrai(!!I18N.en[k], `traduit : ${k}`);
  });
});

/* --- La fenetre de l'objectif se lit du suivi vers les reglages ----------- */
suite('La fenêtre de l’objectif se lit du suivi vers les réglages', () => {
  const panneau = () => {
    const src = lireSource('assets/app.js');
    const i = src.indexOf('  objectif: () => {');
    return src.slice(i, src.indexOf('\n  },', i));
  };

  test('le suivi, la réponse, le départ, l’extrapolation, puis les réglages', () => {
    const f = panneau();
    vrai(f.length > 1000, 'la fenêtre est trouvable');
    const html = f.slice(f.indexOf('html: `'));
    const ordre = ['class="goal-bar"', 'obj-avancement', '${reponse}', '${departLigne}', '${extrapolation}', '${reglages}']
      .map(k => html.indexOf(k));
    vrai(ordre.every(x => x > 0), 'chaque bloc est posé');
    vrai(ordre.every((x, i) => !i || x > ordre[i - 1]), 'dans l’ordre de la question qu’on vient poser');
    vrai(!/champs:\s*\[/.test(f) && !/lignes:\s*sansCible/.test(f), 'plus de champs ni de lignes génériques au milieu du suivi');
    vrai(!/sousAction/.test(f) && !/lien-nu/.test(f), 'plus de lien dans l’en-tête');
    vrai(/class="btn sm ghost" data-action="objectif-depart"/.test(f), 'le départ se change par une action discrète, à côté de lui');
    vrai(/<b class="obj-chiffre">\$\{fmtEUR0\(-g\.remaining\)\}<\/b> \$\{trad\('restants'\)\}/.test(f), 'ce qui reste est le chiffre appuyé');
    vrai(/\$\{fmtEUR0\(pj\.needed\)\} \$\{trad\('\/ mois'\)\}<\/b> \$\{trad\('jusqu’à fin \{a\}'\)/.test(f), 'avec le rythme à tenir');
  });

  test('l’extrapolation se dit comme telle, avec sa période', () => {
    const f = panneau();
    const x = f.slice(f.indexOf('const extrapolation'), f.indexOf('const annees'));
    vrai(/pj\.paceDebut/.test(x) && /pj\.paceFin/.test(x) && /pj\.paceMois/.test(x), 'la période de référence est nommée');
    vrai(/il serait vers/.test(x), 'au conditionnel');
    vrai(!/objectif atteint/i.test(x), 'sans jamais promettre l’objectif atteint');
    vrai(/c’est une extrapolation, pas une prévision/.test(x), 'et elle dit ce qu’elle mêle');
    Fixture.poser(s => {
      s.meta.objective = 200000; s.meta.objectiveYear = new Date().getFullYear() + 1;
      s.monthly = [
        { date: '2026-01-01', comment: '', v: { c_courant: 3000, c_livret: 2000 } },
        { date: '2026-02-01', comment: '', v: { c_courant: 3200, c_livret: 2000 } },
        { date: '2026-03-01', comment: '', v: { c_courant: 3500, c_livret: 2000 } },
      ];
    });
    const pj = objectiveProjection(), g = objectiveStatus();
    eq(pj.paceFin, '2026-03-01', 'la période finit au dernier relevé');
    vrai(pj.paceMois >= 2, 'et couvre les mois entre les relevés');
    pres(pj.needed, pj.monthsLeft ? (200000 - g.total) / pj.monthsLeft : 0, 'le rythme nécessaire ne change pas');
    pres(pj.atPace, g.total + pj.paceRate * pj.monthsLeft, 'ni l’extrapolation elle-même');
  });

  test('le libellé du montant porte sa devise, dans les deux langues', () => {
    const f = panneau();
    vrai(/trad\('Montant visé \(\{dev\}\)'\)/.test(f), 'la devise passe par la traduction');
    vrai(!/\}\s*\(\{dev\}\)/.test(f), 'et plus aucun « ({dev}) » collé hors d’elle');
    Fixture.poser();
    const lu = trad('Montant visé ({dev})');
    vrai(!/\{dev\}/.test(lu) && /€/.test(lu), 'la marque devient le signe de la devise');
    for (const k of ['restants', 'jusqu’à fin {a}', 'au-delà de ta cible', 'Si ton rythme récent se poursuivait',
      'Sur {n} mois, entre {d} et {f}, ton patrimoine a varié de {r} par mois en moyenne.',
      'À ce rythme, il serait vers {v} fin {a}, au-dessus de ta cible.',
      'À ce rythme, il serait vers {v} fin {a}, en dessous de ta cible.',
      'Cette variation mêle tes apports, les marchés et des événements ponctuels : c’est une extrapolation, pas une prévision.',
      'Modifier l’objectif', 'Fixer un objectif', 'Montant visé ({dev})', 'Année', 'Changer',
      'Point de départ à définir pour suivre l’avancement.', '{v} le {d}'])
      vrai(!!I18N.en[k], `traduit : ${k}`);
    /* La date du depart se traduit en entier : « le » seul se traduisait
       « day » et donnait « 1 000 € day 25 Sep 2026 ». */
    vrai(!/trad\('le'\)/.test(f), 'aucun « le » traduit seul dans la fenêtre');
  });
});

/* --- Une fiche de compte dit ce qui vaut pour ce compte ------------------- */
suite('Une fiche de compte ne dit que ce qui vaut pour ce compte', () => {
  test('le délai de vente et les règles de retrait ne se confondent pas', () => {
    eq(mobilisabilite('actions', 'pea'), mobilisabilite('actions', 'cto'),
      'une action se vend au même rythme dans un PEA et dans un compte-titres');
    eq(mobilisabilite('actions', 'per'), 'bloque', 'seul un PER bloque vraiment l’argent');
    const avecRetrait = TYPES_COMPTE.filter(t => t.retrait).map(t => t.id).sort();
    eq(JSON.stringify(avecRetrait), JSON.stringify(['av', 'pea', 'per']),
      'les conditions de retrait se déclarent sur les enveloppes qui en ont');
    for (const t of TYPES_COMPTE.filter(x => x.retrait)) vrai(!!I18N.en[t.retrait], `traduit : ${t.id}`);
    const app = lireSource('assets/app.js');
    const affiche = app.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
    vrai(!/PEA de moins de cinq ans est bloqué/.test(affiche), 'plus aucune aide ne dit un PEA bloqué');
    vrai(/\$\{t\.retrait \? `<p class="hint cpt-retrait">\$\{trad\('Retraits'\)\}/.test(app),
      'la fiche écrit les retraits à part, en tête');
    const store = lireSource('assets/store.js');
    vrai(!/PEA de moins de cinq ans (est|compte)[^.]*bloqu/.test(store),
      'et aucun commentaire publié ne le prétend encore');
  });

  test('le discours du prêt sur titres reste chez les courtiers qui prêtent', () => {
    const marge = TYPES_COMPTE.filter(t => t.pretSurTitres).map(t => t.id).sort();
    eq(JSON.stringify(marge), JSON.stringify(['crypto', 'cto']), 'un compte-titres et un portefeuille crypto');
    const app = lireSource('assets/app.js');
    const i = app.indexOf("<div class=\"card-head\"><h2>${trad('Financement')}${aide(t.pretSurTitres");
    vrai(i > 0, 'la carte du financement choisit son aide');
    const avant = app.slice(i - 900, i);
    vrai(/if \(!dettes\.length && !t\.pretSurTitres\) return '';/.test(avant),
      'sur un livret, un compte courant ou un non coté sans crédit, la carte ne s’affiche pas');
    vrai(/\$\{!t\.pretSurTitres \? '' : `<dl class="kv" style="margin-top:12px">/.test(app),
      'et ni la valeur nette du compte ni le levier ne se calculent hors prêt sur titres');
  });

  test('la fiche dit où l’on met à jour le solde, les placements et les informations', () => {
    const app = lireSource('assets/app.js');
    for (const k of ['Mettre à jour le solde',
      'Touche une ligne pour la modifier ou la vendre.', 'Touche une ligne pour la modifier.',
      'Le nom, le type, l’établissement et les dates du compte. Le solde et les placements se changent dans leurs cartes.']) {
      vrai(app.includes(k), `la fiche le dit : ${k}`);
      vrai(!!I18N.en[k], 'et en anglais');
    }
  });
});

/* --- Archiver dit ce que les totaux perdent, et pourquoi ------------------ */
suite('Archiver un compte dit ce que les totaux perdent', () => {
  test('l’impact se mesure par les totaux eux-mêmes', () => {
    Fixture.poser();
    const net = patrimoine().net;
    const i = impactArchivage('c_livret');
    pres(i.valeur, 2000, 'la valeur du livret');
    pres(i.netAvant, net, 'le net d’avant est celui du jour');
    pres(i.ecartNet, -2000, 'il perd exactement le livret');
    pres(i.netApres, net - 2000, 'et le net d’après s’en déduit');
    eq(compteById('c_livret').statut, 'ouvert', 'la mesure ne laisse pas le compte archivé');
    pres(patrimoine().net, net, 'ni les totaux changés');
  });

  test('un bien financé perd sa valeur entière, son crédit reste compté', () => {
    Fixture.poser();
    const i = impactArchivage('c_immo');
    pres(i.ecartNet, -120000, 'le net baisse de la valeur du bien, pas de sa part nette');
    pres(i.creditRestant, Fixture.DETTE, 'et la fenêtre sait que le crédit reste');
  });

  test('des lignes de titres se comptent, un compte vide ne change rien', () => {
    Fixture.poser();
    const pea = impactArchivage('c_pea');
    eq(pea.lignesTitres, 1, 'une ligne de titres sur le PEA');
    pres(pea.valeurTitres, 9000, 'pour sa valeur de marché');
    Fixture.poser(s => { s.comptes.find(c => c.id === 'c_courant').cash[0].montant = 0; });
    const vide = impactArchivage('c_courant');
    pres(vide.valeur, 0, 'un compte vide');
    pres(vide.ecartNet, 0, 'ne change aucun total');
    compteById('c_courant').statut = 'archive';
    eq(impactArchivage('c_courant'), null, 'un compte déjà archivé n’a plus rien à retirer');
  });

  test('la fenêtre chiffre, demande pourquoi, et n’invente rien', () => {
    const src = lireSource('assets/app.js');
    const i = src.indexOf("async 'archiver-compte'(btn)");
    const f = src.slice(i, src.indexOf('\n  },', i));
    vrai(f.length > 500, 'l’action est trouvable');
    vrai(/const imp = c && impactArchivage\(c\.id\);/.test(f), 'l’impact se calcule avant la question');
    vrai(/if \(imp\.lignesTitres\) \{[\s\S]*?return;\s*\}/.test(f), 'des lignes de titres empêchent d’archiver');
    vrai(/trad\('Ton patrimoine net passerait de \{a\} à \{b\} \(\{e\}\)\.'\)/.test(f), 'l’écart se dit en chiffres');
    vrai(/imp\.creditRestant > 0\.005/.test(f), 'et le crédit qui reste compté aussi');
    vrai(/if \(!vide && !x\.motif\) return \{ cle: 'motif'/.test(f), 'la raison est demandée dès qu’il y a de l’argent');
    vrai(/c\.archiveMotif = v\.motif/.test(f), 'et notée sur le compte');
    vrai(!/monthly|mouvementCash|sales\.push|declarerVente/.test(f),
      'ni relevé touché, ni versement ni vente inventés');
    eq(JSON.stringify(MOTIFS_ARCHIVE.map(([k]) => k)), JSON.stringify(['transfert', 'sortie', 'correction']),
      'trois raisons, et elles seules');
    const r = src.slice(src.indexOf("async 'restaurer-compte'(btn)"), src.indexOf("async 'annuler-fiche'(btn)"));
    vrai(/delete c\.archiveMotif;/.test(r), 'restaurer efface la raison, comme la date de clôture');
    vrai(/const c = x\.compte;[\s\S]{0,300}c\?\.archiveMotif/.test(src), 'la liste des archives relit la raison');
    for (const [, l] of MOTIFS_ARCHIVE) vrai(!!I18N.en[l], `traduit : ${l}`);
  });
});

/* --- Archiver par transfert : tout ou rien, et aucun euro cree ni perdu ---- */
suite('Archiver par transfert, et les titres restés sur un compte archivé', () => {
  const cashTotal = () => round2(COMPTES().filter(c => c.statut !== 'archive')
    .reduce((s, c) => s + (c.cash || []).reduce((x, e) => x + num(e.montant), 0), 0));

  test('transfert complet : le net ne bouge pas, l’argent change de compte', () => {
    Fixture.poser();
    const net = patrimoine().net, cash = cashTotal(), releves = JSON.stringify(Store.state.monthly);
    const r = archiverParTransfert({ source: 'c_livret', destination: 'c_courant', partie: partieSuggeree('c_courant', { credit: true }), montant: 2000, clotureLe: '2026-09-25' });
    vrai(r.ok, 'le transfert aboutit');
    pres(patrimoine().net, net, 'le patrimoine net est identique');
    pres(cashTotal(), cash, 'et les espèces des comptes ouverts aussi : aucun euro créé ni perdu');
    const courant = compteById('c_courant');
    pres(courant.cash.reduce((s, e) => s + num(e.montant), 0), 5000, 'le compte courant reçoit le solde');
    eq(courant.cash.length, 1, 'dans sa poche existante, sans poche « à investir » inventée');
    const livret = compteById('c_livret');
    eq(livret.statut, 'archive', 'le livret est archivé dans le même geste');
    eq(livret.archiveMotif, 'transfert', 'pour un transfert');
    eq(livret.archiveVers, 'c_courant', 'et il sait vers où');
    pres(livret.cash.reduce((s, e) => s + num(e.montant), 0), 0, 'son solde est parti');
    eq(JSON.stringify(Store.state.monthly), releves, 'les relevés ne sont pas touchés');
    livret.statut = 'ouvert'; refreshAccounts();
    pres(patrimoine().net, net, 'le restaurer ne compte pas deux fois le même argent');
  });

  test('un transfert partiel dit ce qui sort', () => {
    Fixture.poser();
    const net = patrimoine().net;
    const r = archiverParTransfert({ source: 'c_livret', destination: 'c_courant', partie: partieSuggeree('c_courant', { credit: true }), montant: 1500 });
    vrai(r.ok, 'le transfert aboutit');
    pres(r.ecartNet, -500, 'la part non transférée sort');
    pres(patrimoine().net, net - 500, 'et le net baisse de cette part, pas davantage');
  });

  test('annulation et refus : rien ne change', () => {
    Fixture.poser();
    const avant = JSON.stringify(Store.state);
    for (const [cas, arg] of [
      ['plus que le solde', { source: 'c_livret', destination: 'c_courant', montant: 2500 }],
      ['un montant nul', { source: 'c_livret', destination: 'c_courant', montant: 0 }],
      ['un compte qui ne porte pas de cash', { source: 'c_livret', destination: 'c_pe', montant: 2000 }],
      ['vers lui-même', { source: 'c_livret', destination: 'c_livret', montant: 2000 }],
      ['un bien', { source: 'c_immo', destination: 'c_courant', montant: 1 }],
      ['un compte à titres', { source: 'c_pea', destination: 'c_courant', montant: 1 }],
    ]) {
      eq(archiverParTransfert(arg).ok, false, `refusé : ${cas}`);
      eq(JSON.stringify(Store.state), avant, `et l’état n’a pas bougé : ${cas}`);
    }
    /* Annuler la fenetre : rien ne s'ecrit avant la reponse. */
    const src = lireSource('assets/app.js');
    const i = src.indexOf("async 'archiver-compte'(btn)");
    const f = src.slice(i, src.indexOf('\n  },', i));
    const fin = f.indexOf('if (!v) return;');
    vrai(fin > 0 && fin < f.indexOf('archiverParTransfert(') && fin < f.indexOf("c.statut = 'archive'"),
      'fermer la fenêtre sort avant toute écriture');
  });

  test('échec partiel : tout ou rien', () => {
    Fixture.poser();
    const avant = JSON.stringify(Store.state);
    const panne = enTransaction(() => {
      compteById('c_courant').cash[0].montant += 999;
      compteById('c_livret').statut = 'archive';
      throw new Error('panne');
    });
    eq(panne.ok, false, 'une panne au milieu échoue');
    eq(JSON.stringify(Store.state), avant, 'et ne laisse aucune des deux écritures');
    const faux = enTransaction(() => { compteById('c_courant').cash[0].montant += 1; return true; }, () => false);
    eq(faux.ok, false, 'une vérification qui ne tient pas échoue aussi');
    eq(JSON.stringify(Store.state), avant, 'sans rien laisser');
    const bloc = lireSource('assets/store.js');
    const t = bloc.slice(bloc.indexOf('function archiverParTransfert('), bloc.indexOf('function archivesAvecTitres('));
    vrai(/const t = enTransaction\(/.test(t) && /patrimoine\(\)\.net - \(netAvant - \(solde - m\)\)/.test(t),
      'le transfert passe par la transaction, gardé par le net au centime');
  });

  test('un bien avec crédit restant ne se transfère pas, et son crédit reste compté', () => {
    Fixture.poser();
    eq(soldeTransferable(compteById('c_immo')), null, 'un bien n’est pas un solde en espèces');
    eq(soldeTransferable(compteById('c_pe')), null, 'un placement non plus');
    eq(soldeTransferable(compteById('c_pea')), null, 'ni un compte qui porte des titres');
    pres(soldeTransferable(compteById('c_livret')), 2000, 'un livret, si');
    const i = impactArchivage('c_immo');
    pres(i.creditRestant, Fixture.DETTE, 'la fenêtre sait que le crédit reste');
    compteById('c_immo').statut = 'archive'; refreshAccounts();
    pres(dettesTotal(), Fixture.DETTE, 'archivé, le bien laisse son crédit compté');
    const src = lireSource('assets/app.js');
    vrai(/const motifs = MOTIFS_ARCHIVE\.filter\(\(\[k\]\) => k !== 'transfert' \|\| transferable\);/.test(src),
      '« transfert » ne se propose que si le solde peut vraiment partir');
    vrai(/estBien\(t\) \? trad\('Archiver ne vend pas ce bien/.test(src), 'et la fenêtre dit le geste qui manque');
  });

  test('un ancien compte archivé qui porte des titres se voit et se résout sans rien inventer', () => {
    Fixture.poser(s => { s.comptes.find(c => c.id === 'c_pea').statut = 'archive'; });
    const lignesDe_ = () => Store.state.positions.map(p => `${p.id}:${p.account}:${num(p.qty)}`).join('|');
    const avantMigration = lignesDe_();
    Store.migrate(); refreshAccounts();
    eq(lignesDe_(), avantMigration, 'la migration ne déplace, ne supprime ni ne vend aucune ligne');
    const positions = JSON.stringify(Store.state.positions);
    eq(compteById('c_pea').statut, 'archive', 'et laisse le compte archivé');
    const x = archivesAvecTitres();
    eq(x.length, 1, 'le cas est détecté');
    eq(x[0].compte.id, 'c_pea', 'sur le PEA');
    pres(x[0].valeur, 9000, 'pour la valeur de ses lignes');
    vrai(healthChecks().some(n => n.cle === 'archive-titres:c_pea' && n.level === 'warn'), 'la cloche le signale');
    eq(destinationAuto('c_pea'), null, 'une vente n’y poserait pas son produit, hors du patrimoine');
    const net = patrimoine().net, marches = stockTotals().balance;
    const ventes = JSON.stringify(Store.state.sales), releves = JSON.stringify(Store.state.monthly);
    eq(deplacerLignesArchivees('c_pea', 'c_livret').ok, false, 'un livret ne reçoit pas de titres');
    eq(JSON.stringify(Store.state.positions), positions, 'et rien n’a bougé');
    const r = deplacerLignesArchivees('c_pea', 'c_cto');
    vrai(r.ok, 'les lignes passent sur un compte ouvert');
    pres(patrimoine().net, net + 9000, 'elles reviennent dans le patrimoine pour leur valeur');
    pres(stockTotals().balance, marches, 'Marchés ne bouge pas : l’écart se referme');
    eq(archivesAvecTitres().length, 0, 'le cas est résolu');
    eq(JSON.stringify(Store.state.sales), ventes, 'aucune vente inventée');
    eq(JSON.stringify(Store.state.monthly), releves, 'et les relevés intacts');
    const src = lireSource('assets/app.js');
    vrai(/\$\{carteTitresArchives\(\)\}/.test(src), 'Marchés affiche l’écart tant qu’il existe');
    vrai(/async 'resoudre-titres-archives'\(btn\)/.test(src), 'et propose de le résoudre');
    for (const k of ['Elles sont sur un autre compte : les y déplacer', 'Elles ont été vendues : enregistrer chaque vente',
      'Le compte est toujours ouvert : le restaurer', 'Marchés compte des titres que ton patrimoine ne compte pas'])
      vrai(!!I18N.en[k], `traduit : ${k}`);
  });
});

/* --- Une valeur dit ce qu'elle est, et de quand elle date ---------------- */
suite('Une valeur dit de quand elle date', () => {
  const ilYA = jours => new Date(Date.now() - jours * 864e5).toISOString().slice(0, 10);

  test('la date suit le montant, et rien d’autre', () => {
    Fixture.poser();
    eq(dateQuiSuit('comptes.1.cash.0.montant').chemin, 'comptes.1.cash.0.saisiLe', 'un solde se date à sa saisie');
    eq(dateQuiSuit('comptes.1.cash.0.montant').genre, 'solde', 'et c’est une saisie, pas une vérification');
    eq(dateQuiSuit('etabs.2.dettes.0.montant').chemin, 'etabs.2.dettes.0.verifieLe', 'un capital, à sa vérification');
    const iImmo = Store.state.comptes.findIndex(c => c.id === 'c_immo');
    eq(dateQuiSuit(`comptes.${iImmo}.lignes.0.valeur`).genre, 'estimation', 'un bien, à son estimation');
    const iPe = Store.state.comptes.findIndex(c => c.id === 'c_pe');
    eq(dateQuiSuit(`comptes.${iPe}.lignes.0.valeur`), null, 'un prêt au nominal ne vieillit pas');
    eq(dateQuiSuit('comptes.1.libelle'), null, 'un nom ne date rien');
    vrai(!montantChange(100, 100) && !montantChange('', undefined), 'un montant réécrit à l’identique ne change pas');
    vrai(montantChange(100, 120) && montantChange(100, ''), 'un montant corrigé ou effacé change');
  });

  test('une fenêtre garde la date qu’on pose, et date du jour ce qu’on y enregistre', () => {
    /* La fenetre est le formulaire du montant : y appuyer sur « Enregistrer »
       vaut relecture, montant change ou non. C'est la regle depuis le 26
       septembre 2026 ; avant, un montant inchange gardait sa date. */
    const jour = '2026-09-25';
    eq(dateApresSaisie({ avant: 100, apres: 100, dateAvant: '2026-01-10', dateSaisie: '2026-01-10', genre: 'credit', jour }),
      jour, 'réenregistrer dans la fenêtre du capital le vérifie du jour, même inchangé');
    eq(dateApresSaisie({ avant: 100, apres: 90, dateAvant: '2026-01-10', dateSaisie: '2026-01-10', genre: 'credit', jour }),
      jour, 'un capital corrigé est un capital relu');
    eq(dateApresSaisie({ avant: 100, apres: 100, dateAvant: '2026-01-10', dateSaisie: '2026-09-20', genre: 'credit', jour }),
      '2026-09-20', 'une date posée à la main gagne, montant inchangé compris');
    eq(dateApresSaisie({ avant: 100, apres: 90, dateAvant: '', dateSaisie: '2026-09-01', genre: 'estimation', jour }),
      '2026-09-01', 'y compris quand le montant change');
    eq(dateApresSaisie({ avant: 100, apres: 100, dateAvant: '', dateSaisie: '', genre: 'credit', jour }),
      jour, 'un capital jamais vérifié le devient dès qu’on l’enregistre dans sa fenêtre');
    eq(dateApresSaisie({ avant: 10, apres: 11, dateAvant: '2026-06-30', dateSaisie: '2026-06-30', genre: 'vl', jour }),
      null, 'une VL changée sans sa date devient sans date, pas datée du jour');
    eq(dateApresSaisie({ avant: 10, apres: 10, dateAvant: '2026-06-30', dateSaisie: '2026-06-30', genre: 'vl', jour }),
      '2026-06-30', 'et une VL inchangée garde la date de sa publication');
  });

  test('un compte n’est pas plus frais que sa part la plus ancienne', () => {
    Fixture.poser(s => {
      const cc = s.comptes.find(c => c.id === 'c_courant');
      cc.cash = [{ montant: 3000, affectation: 'courant', saisiLe: '2026-09-01' },
                 { montant: 500, affectation: 'precaution', saisiLe: '2026-07-15' }];
      s.comptes.find(c => c.id === 'c_immo').lignes[0].estimeLe = '2026-03-12';
      s.quotes = { lastRun: '2026-09-24T18:00:00Z' };
    });
    const de = id => datesDuCompte(compteById(id));
    eq(JSON.stringify(de('c_courant')), JSON.stringify([{ genre: 'solde', date: '2026-07-15' }]),
      'deux parts, la plus ancienne date le compte');
    eq(JSON.stringify(de('c_livret')), JSON.stringify([{ genre: 'solde', date: null }]),
      'une part sans date rend le solde sans date');
    eq(JSON.stringify(de('c_immo')), JSON.stringify([{ genre: 'estimation', date: '2026-03-12' }]),
      'un bien dit sa date d’estimation');
    eq(JSON.stringify(de('c_pea').map(x => x.genre)), JSON.stringify(['solde', 'cours']),
      'un PEA porte ses espèces et ses cours');
    eq(de('c_pea')[1].date, '2026-09-24', 'les cours du dernier rafraîchissement');
    eq(de('c_pe').length, 0, 'un prêt au nominal n’a rien à dater');
    compteById('c_cto').cash = [{ montant: 0, affectation: 'investir' }];
    eq(JSON.stringify(de('c_cto').map(x => x.genre)), JSON.stringify(['cours']), 'zéro euro ne se date pas');
  });

  test('le relevé liste les soldes sans date en une ligne, et les vieux un par un', () => {
    Fixture.poser(s => {
      s.comptes.find(c => c.id === 'c_courant').cash[0].saisiLe = ilYA(40);
      s.comptes.find(c => c.id === 'c_livret').cash[0].saisiLe = ilYA(3);
    });
    const f = aRafraichir();
    const vieux = f.filter(x => x.genre === 'solde');
    eq(vieux.length, 1, 'un solde saisi il y a quarante jours se relit');
    eq(vieux[0].compteId, 'c_courant', 'c’est le compte courant');
    vrai(!f.some(x => x.compteId === 'c_livret'), 'un solde saisi cette semaine ne se réclame pas');
    const sans = f.filter(x => x.genre === 'soldesSansDate');
    eq(sans.length, 1, 'les soldes jamais datés tiennent en une entrée');
    vrai(sans[0].noms.includes('PEA') && !sans[0].noms.includes('Livret A'), 'qui les nomme, et eux seuls');
  });

  test('les écrans lisent ces dates, et seul le formulaire d’un montant les pose', () => {
    const src = lireSource('assets/app.js');
    const champ = src.slice(src.indexOf('function applyField('), src.indexOf('function applyField(') + 3000);
    vrai(/const suivi = dateQuiSuit\(path\);[\s\S]{0,200}if \(suivi && montantChange\(avant, getPath\(path\)\)\) setPath\(suivi\.chemin, dateApresChangement\(suivi\.genre\)\);/.test(champ),
      'une frappe ne date que le montant qui change');
    const apercu = src.slice(src.indexOf("'apercu-enregistrer'()"), src.indexOf("'apercu-enregistrer'()") + 700);
    vrai(!/verifieLe = todayISO\(\)/.test(apercu), 'enregistrer le panneau des crédits ne date plus ceux qu’on n’a pas touchés');
    const iCredit = src.indexOf("async 'editer-credit'(btn)");
    const credit = src.slice(iCredit, src.indexOf('\n  },', iCredit));
    vrai(/\{ cle: 'verifieLe', label: trad\('Vérifié le'\), type: 'date'/.test(credit), 'la fenêtre du crédit porte sa date');
    vrai(/d\.verifieLe = dateApresSaisie\(\{/.test(credit) && !/d\.verifieLe = todayISO\(\)/.test(credit),
      'et la pose par la règle commune, qui laisse gagner une date écrite à la main');
    vrai(/estimeLe: dateApresSaisie\(\{/.test(src.slice(src.indexOf('function litPlacement('), src.indexOf('function litPlacement(') + 1200)),
      'la fenêtre d’une ligne suit la même règle');
    vrai(!/Valeur estimée aujourd\\'hui/.test(src), 'la fiche d’un bien ne dit plus « aujourd’hui » pour une estimation');
    vrai(/data-path="comptes\.\$\{idx\}\.lignes\.\$\{i\}\.estimeLe"/.test(src), 'et sa date d’estimation se lit et se corrige à côté');
    vrai(/const dates = datesDuCompte\(c\)\.map\(phraseDateValeur\)/.test(src), 'l’en-tête d’une fiche dit de quand date son montant');
    vrai(/saisiLe: todayISO\(\)/.test(src.slice(src.indexOf('const saisi = m =>'), src.indexOf('const saisi = m =>') + 200)),
      'un solde tapé à la création se date');
    for (const k of ['solde vérifié le {d}', 'solde jamais vérifié', 'Soldes jamais vérifiés',
      'estimation sans date', 'cours du {d}', 'cours jamais actualisés', 'Vérifié le'])
      vrai(!!I18N.en[k], `traduit : ${k}`);
  });
});

/* --- Annuler rend tout ce qu'une fiche a ecrit ---------------------------- */
suite('Annuler une fiche rend aussi le crédit et les lignes', () => {
  const dette = () => etabById('e_bien').dettes[0];
  const studio = () => compteById('c_immo');

  test('le crédit seul modifié se voit et se rend', () => {
    Fixture.poser();
    const inst = instantaneFiche('compte:c_immo');
    vrai(!ficheDiffere(inst), 'sortie sans modification : rien à annuler');
    dette().montant = 35000;
    vrai(ficheDiffere(inst), 'le capital restant dû changé suffit à rendre la fiche modifiée');
    vrai(retablirInstantane(inst), 'la restauration a lieu');
    pres(dette().montant, Fixture.DETTE, 'et le capital revient');
    vrai(!ficheDiffere(inst), 'plus rien ne diffère');
    pres(dettesTotal(), Fixture.DETTE, 'les totaux relisent l’ancien crédit');
  });

  test('le bien et son crédit se rendent ensemble', () => {
    Fixture.poser();
    const inst = instantaneFiche('compte:c_immo');
    studio().lignes[0].valeur = 125000;
    dette().montant = 38000;
    dette().taux = 3.2;
    vrai(ficheDiffere(inst), 'deux objets modifiés, une seule fiche');
    retablirInstantane(inst);
    pres(studio().lignes[0].valeur, 120000, 'la valeur du bien revient');
    pres(dette().montant, Fixture.DETTE, 'le capital aussi');
    eq(dette().taux, undefined, 'et un champ qui n’existait pas disparaît');
  });

  test('après Enregistrer, Annuler ne défait plus rien', () => {
    Fixture.poser();
    dette().montant = 36000;
    /* « Enregistrer » oublie l'instantane et en reprend un au rendu suivant. */
    const inst = instantaneFiche('compte:c_immo');
    vrai(!ficheDiffere(inst), 'le point de retour est le dernier enregistrement');
    retablirInstantane(inst);
    pres(dette().montant, 36000, 'la valeur enregistrée reste');
  });

  test('la fiche d’un établissement couvre le compte du bien qu’il porte', () => {
    Fixture.poser();
    const inst = instantaneFiche('etab:e_bien');
    studio().apport = 20000;
    studio().notes = 'à revoir';
    vrai(ficheDiffere(inst), 'les champs du compte écrits depuis l’établissement comptent');
    retablirInstantane(inst);
    eq(studio().apport, undefined, 'l’apport revient à rien');
    eq(studio().notes, '', 'et les notes à ce qu’elles étaient');
  });

  test('la mobilité d’une ligne de titres se rend, pas son cours', () => {
    Fixture.poser();
    const etf = () => Store.state.positions.find(p => p.id === 'p_etf');
    const inst = instantaneFiche('compte:c_pea');
    etf().price = 95;
    vrai(!ficheDiffere(inst), 'un cours rafraîchi n’est pas une modification de la fiche');
    etf().mobilite = 'lent';
    vrai(ficheDiffere(inst), 'la mobilité choisie en est une');
    retablirInstantane(inst);
    eq(etf().mobilite, undefined, 'elle revient');
    pres(etf().price, 95, 'et le cours du jour reste celui du jour');
    /* Le champ que la fiche ecrit est bien celui que l'instantane couvre. */
    for (const l of lignesDe(compteById('c_pea')).filter(x => x.marche))
      vrai(CHAMPS_POSITION_FICHE.includes(l.refMobilite.split('.').pop()), `${l.refMobilite} est couvert`);
  });

  test('un compte hors de la fiche n’est ni comparé ni restauré', () => {
    Fixture.poser();
    const inst = instantaneFiche('compte:c_immo');
    compteById('c_courant').cash[0].montant = 3500;
    vrai(!ficheDiffere(inst), 'le compte courant ne fait pas partie de la fiche du studio');
    retablirInstantane(inst);
    pres(compteById('c_courant').cash[0].montant, 3500, 'et il n’est pas remis en arrière');
    eq(instantaneFiche('compte:inconnu'), null, 'une fiche sans objet n’a pas d’instantané');
    vrai(!ficheDiffere(null) && !retablirInstantane(null), 'et rien ne se compare ni ne se rend');
  });

  test('la vue lit ce périmètre, l’oublie en partant, et le reprend après un acte', () => {
    const src = lireSource('assets/app.js');
    vrai(/function memoriserFiche\(cle\) \{\s*if \(!ficheAvant \|\| ficheAvant\.cle !== cle\) ficheAvant = instantaneFiche\(cle\);/.test(src),
      'l’instantané couvre la famille de la fiche');
    vrai(/return ficheDiffere\(ficheAvant\);/.test(src) && /return retablirInstantane\(ficheAvant\);/.test(src),
      'la détection et la restauration passent par le modèle');
    const rendu = src.slice(src.indexOf('function render() {'), src.indexOf('function render() {') + 600);
    vrai(/if \(ficheAvant && ficheAvant\.cle !== cleFicheCourante\(key\)\) ficheAvant = null;/.test(rendu),
      'quitter la fiche oublie son instantané : un retour ne compare pas à une photo périmée');
    vrai(/suivreActeSurFiche\(btn\.dataset\.action, \(\) => fn\(btn\)\)/.test(src),
      'chaque acte passe par le suivi de la fiche');
    const suivi = src.slice(src.indexOf('async function suivreActeSurFiche('), src.indexOf('async function suivreActeSurFiche(') + 600);
    vrai(/!== avant\) \{\s*ficheAvant = instantaneFiche\(cle\);/.test(suivi),
      'un acte qui change la fiche devient le nouveau point de retour');
    vrai(/ACTES_QUI_GERENT_LA_FICHE = new Set\(\['annuler-fiche', 'enregistrer-fiche'\]\)/.test(src),
      'Annuler et Enregistrer gèrent l’instantané eux-mêmes');
    const credits = src.slice(src.indexOf('function creditsDuCompte('), src.indexOf('function creditsDuCompte(') + 200);
    vrai(/ETABS\(\)\.findIndex\(e => e\.id === c\.etabId\)/.test(credits),
      'les crédits édités par la fiche sont ceux de l’établissement du compte, que le périmètre inclut');
  });
});

/* --- Marches parle de la cible, et de rien qu'il ne sache ---------------- */
suite('Les insights de Marchés', () => {
  test('l’écart à la cible vit là où la cible se règle, et aucun apport n’est lu', () => {
    eq(REGLES_INSIGHT.find(r => r.id === 'allocation_target_gap').onglet, 'positions',
      'la cible est un sous-onglet de Marchés');
    vrai(!REGLES_INSIGHT.some(r => /^market_/.test(r.id)), 'aucune règle d’apports ni d’origine d’une hausse');
    const src = lireSource('assets/app.js') + lireSource('assets/store.js');
    vrai(!/apportsMarche|relApports|intervallesMarche/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')),
      'le relevé ne demande plus d’apport, et rien ne le lit');
  });
});

/* --- Une demonstration plus ancienne que sa graine se propose a jour -------- */
suite('La démonstration propose sa nouvelle version', () => {
  test('seule une copie plus ancienne de la graine se propose', () => {
    /* Un etat sans numero de graine n'est pas ne d'elle : c'est un visiteur
       qui a tout efface pour saisir ses chiffres, ou de vraies donnees. */
    Fixture.poser();
    eq(demoPerimee(), false, 'un état sans numéro de graine ne se remplace jamais');
    if (typeof SEED_VERSION === 'undefined') return;   // bêta et instance privée : aucune graine versionnée
    Fixture.poser(s => { s.seedVersion = SEED_VERSION - 1; });
    eq(demoPerimee(), true, 'une copie plus ancienne se propose');
    Fixture.poser(s => { s.seedVersion = SEED_VERSION; });
    eq(demoPerimee(), false, 'une copie à jour se tait');
  });

  test('le bandeau suit l’état, et recharger se demande et se sauvegarde', () => {
    const src = lireSource('assets/app.js');
    vrai(/const graine = \$\('#bandeauGraine'\);\s*if \(graine\) graine\.hidden = !demoPerimee\(\);/.test(src),
      'le bandeau se montre à chaque rendu, seulement quand la démo a vieilli');
    const action = src.slice(src.indexOf("async 'recharger-demo'()"), src.indexOf("'quitter-demo'()"));
    vrai(action.indexOf('askConfirm(') > 0 && action.indexOf('askConfirm(') < action.indexOf('rechargerDemo()'),
      'la question vient avant le remplacement');
    vrai(action.indexOf("Store.addBackup('avant rechargement de la démo')") > 0
      && action.indexOf("Store.addBackup(") < action.indexOf('rechargerDemo()'),
      'et une sauvegarde garde les essais du visiteur');
    if (typeof SEED_VERSION === 'undefined') return;
    vrai(/id="bandeauGraine" hidden>[\s\S]*data-action="recharger-demo"/.test(lireSource('index.html')),
      'le bandeau existe, caché par défaut, avec son bouton');
  });
});



/* ------------------------------------------------------------------
   4 bis. Les espèces, qui n'ont pas d'établissement
   ------------------------------------------------------------------ */
suite('Les espèces sont toujours là', () => {

  /* Le compte d'especes bricole a la main : de l'argent liquide dont le
     contenant ne s'appelle que « Espèces », faute de mieux. C'est ce que la
     migration doit adopter, pas doubler. */
  const avecBricolage = (nomEtab = 'Espèces', nomCompte = 'Real Cash') =>
    Fixture.poser(s => {
      s.etabs.push({ id: 'e_esp', nom: nomEtab, notes: '', dettes: [] });
      s.comptes.push({ id: 'c_liquide', etabId: 'e_esp', type: 'courant', statut: 'ouvert',
        ouvertLe: '', numero: '', notes: '', libelle: nomCompte, court: '', alloc: '',
        cash: [{ montant: 650, affectation: 'courant' }], lignes: [] });
    });

  const especes = () => COMPTES().filter(c => c.type === 'especes');
  const brut = () => comptesOuverts().reduce((s, c) => s + valeurCompte(c), 0);

  test('un état sans espèces en reçoit un, vide', () => {
    Fixture.poser();
    const avant = brut();
    poserEspeces(Store.state);
    eq(especes().length, 1, 'un seul compte d’espèces, pas deux');
    eq(valeurCompte(especes()[0]), 0, 'à zéro : personne n’a déclaré de billets');
    eq(brut(), avant, 'et le patrimoine ne bouge pas d’un euro');
    eq(especes()[0].etabId, null, 'personne ne tient ces billets pour vous');
  });

  test('le compte bricolé est adopté, pas doublé', () => {
    /* Le defaut a eviter : ajouter un compte d'especes a cote de celui qui
       existait deja compterait deux fois le meme argent. */
    avecBricolage();
    const avant = brut();
    poserEspeces(Store.state);
    eq(especes().length, 1, 'un seul');
    eq(especes()[0].id, 'c_liquide', 'le même identifiant : les relevés passés y sont indexés');
    eq(valeurCompte(especes()[0]), 650, 'son montant est conservé');
    eq(brut(), avant, 'donc le total ne change pas');
    eq(especes()[0].etabId, null, 'il quitte l’établissement qu’on avait inventé');
    eq(ETABS().some(e => e.id === 'e_esp'), false,
      'et cet établissement, devenu vide, disparaît de la liste');
  });

  test('« Real Cash » cesse de s’appeler ainsi', () => {
    /* Un nom de contournement, en anglais dans une application française. Vide,
       le libelle laisse parler celui du type. */
    avecBricolage();
    poserEspeces(Store.state);
    eq(nomCompteV2(especes()[0]), 'Espèces');
    /* Un nom choisi, lui, survit : ce n'est plus un contournement. */
    avecBricolage('Espèces', 'Ma tirelire');
    poserEspeces(Store.state);
    eq(nomCompteV2(especes()[0]), 'Ma tirelire', 'ce que l’utilisateur a écrit reste');
  });

  test('un vrai compte courant n’est pas confondu avec des espèces', () => {
    /* Le filet ne doit attraper que le bricolage. Un compte de cash chez une
       vraie banque n'en est pas : le convertir le sortirait de son
       etablissement, et son solde deviendrait des billets.

       Les noms sont inventes, et ce n'est pas un detail : la premiere version de
       ce test reprenait un identifiant et un nom de banque du jeu de donnees
       reel. AGENTS.md l'interdit, le fixture doit rester synthetique, et ces
       tests partent aussi dans la demo publique. */
    Fixture.poser(s => {
      s.comptes.push({ id: 'c_banque', etabId: 'e_banque', type: 'courant', statut: 'ouvert',
        ouvertLe: '', numero: '', notes: '', libelle: 'Cash de la banque', court: '', alloc: '',
        cash: [{ montant: 900, affectation: 'courant' }], lignes: [] });
    });
    poserEspeces(Store.state);
    eq(especes().length, 1, 'un compte d’espèces a bien été créé');
    eq(especes()[0].id !== 'c_banque', true, 'mais ce n’est pas le compte de la banque');
    eq(compteById('c_banque').etabId, 'e_banque', 'qui reste chez elle');
  });

  test('la jouer deux fois donne le même état', () => {
    /* La regle des migrations. Celle-ci n'a pas de drapeau dans `meta` : sa
       garde est l'etat lui-meme, donc c'est exactement ce qu'il faut verifier. */
    for (const depart of [() => Fixture.poser(), () => avecBricolage()]) {
      depart();
      poserEspeces(Store.state);
      const une = JSON.stringify({ c: Store.state.comptes, e: Store.state.etabs });
      poserEspeces(Store.state);
      const deux = JSON.stringify({ c: Store.state.comptes, e: Store.state.etabs });
      eq(deux, une, 'le second passage ne doit rien changer');
    }
  });

  test('l’établissement inventé survit s’il porte encore un crédit', () => {
    /* Un contenant vide qu'on efface est un menage. Un contenant qui doit de
       l'argent qu'on efface est un patrimoine faux : la dette se soustrayait du
       net, elle disparaitrait avec lui. */
    Fixture.poser(s => {
      s.etabs.push({ id: 'e_esp', nom: 'Espèces', notes: '',
        dettes: [{ id: 'd_x', libelle: 'Reste à rendre', montant: 300, note: '' }] });
      s.comptes.push({ id: 'c_liquide', etabId: 'e_esp', type: 'courant', statut: 'ouvert',
        ouvertLe: '', numero: '', notes: '', libelle: 'Real Cash', court: '', alloc: '',
        cash: [{ montant: 650, affectation: 'courant' }], lignes: [] });
    });
    const netAvant = dettesTotal();
    poserEspeces(Store.state);
    vrai(ETABS().some(e => e.id === 'e_esp'), 'l’établissement reste, il doit encore');
    eq(dettesTotal(), netAvant, 'et la dette pèse toujours autant');
  });

  test('le type des espèces dit ce qu’il est', () => {
    const t = typeCompte('especes');
    eq(t.label, 'Espèces');
    eq(t.classes.join(','), 'liquidites', 'des billets ne sont rien d’autre');
    eq(t.groupe, 'cash');
    vrai(t.interne, 'il ne se choisit pas dans une liste');
    vrai(t.sansEtab, 'et il n’a pas de contenant');
    eq(TYPES_COMPTE[TYPES_COMPTE.length - 1].id, 'especes',
      'dernier de la table, donc dernier groupe à l’écran : c’est la plus petite ligne');
  });

  test('la barre du bas et le menu se répondent', () => {
    /* Trois accords tiennent la navigation, et aucun n'est visible a l'oeil :

       — la pastille glissante ne connait que cinq positions, ecrites en CSS.
         Un sixieme onglet la laisserait sur le premier, sans erreur ;
       — chaque onglet de la barre doit exister dans le menu, parce que c'est
         de la barre qu'on derive ce que le tiroir masque au telephone. Un
         onglet absent du menu ne serait jamais reconnu comme doublon ;
       — le tiroir doit garder au moins une page que la barre ne porte pas.
         Sinon il s'ouvre vide, et cette page devient inatteignable au doigt.
         C'est le risque qu'a cree le depart de l'onglet « Plus ». */
    const html = lireSource('index.html');
    const css = lireSource('assets/styles.css');
    vrai(html && css, 'index.html et styles.css doivent être lisibles');

    const bloc = deb => { const i = html.indexOf(deb); return html.slice(i, html.indexOf('</nav>', i)); };
    const vues = s => [...s.matchAll(/data-view="([^"]+)"/g)].map(m => m[1]);
    const barre = vues(bloc('<nav class="tabbar"'));
    const menu = vues(bloc('<nav class="nav"'));

    vrai(barre.length >= 4 && menu.length >= 4, 'les deux navigations doivent être trouvées');
    const positions = (css.match(/\.tabbar:has\(> :nth-child\(\d+\)\.on\)/g) || []).length;
    eq(positions, barre.length,
      'la pastille glissante doit connaître exactement une position par onglet');

    for (const v of barre) vrai(menu.includes(v),
      `« ${v} » est dans la barre mais pas dans le menu : le tiroir ne saura pas que c’est un doublon`);
    vrai(menu.some(v => !barre.includes(v)),
      'le tiroir doit garder une page que la barre ne porte pas, sinon elle devient inatteignable');

    /* Deux entrees peuvent viser la meme vue sur deux onglets — Donnees et
       Preferences. Elles doivent alors porter un `data-onglet` distinct : la
       surbrillance se decide sur la vue courante, qui est la meme pour les
       deux, et sans lui les deux s'allumeraient ensemble. */
    const liens = [...bloc('<nav class="nav"').matchAll(/<a\b[^>]*>/g)].map(m => m[0]);
    const parVue = {};
    for (const a of liens) {
      const vue = (a.match(/data-view="([^"]+)"/) || [])[1];
      if (!vue) continue;
      (parVue[vue] = parVue[vue] || []).push((a.match(/data-onglet="([^"]+)"/) || [])[1] || '');
    }
    for (const [vue, onglets] of Object.entries(parVue)) {
      if (onglets.length < 2) continue;
      eq(new Set(onglets).size, onglets.length,
        `les ${onglets.length} entrées de « ${vue} » doivent porter des data-onglet distincts`);
      vrai(onglets.every(Boolean),
        `chaque entrée de « ${vue} » doit dire son onglet, sinon elles s’allument ensemble`);
    }
  });

  test('un compte sans établissement reste visible dans la liste', () => {
    /* Le regroupement par etablissement parcourt les etablissements. Un compte
       qui n'en a pas n'apparaitrait donc dans aucun groupe, et le total de la
       page cesserait d'egaler la somme de ses parts — sans que rien ne le dise.
       Le rendu vit dans app.js, que le harnais ne charge pas : on lit la
       branche concernee, bornee a elle seule. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const debut = src.indexOf("compteVue === 'banque'");
    const branche = src.slice(debut, src.indexOf("compteVue === 'type'", debut));
    /* La borne haute a suivi la branche : la ligne des especes a zero et son
       commentaire l'ont fait passer 6 000 caracteres. */
    vrai(debut > 0 && branche.length > 500 && branche.length < 7000,
      'la tranche lue doit être la branche « par établissement » seule');
    vrai(/!c\.etabId/.test(branche),
      'elle doit ramasser les comptes sans établissement');
    vrai(/groupe\('e-sans'/.test(branche),
      'dans un groupe à eux, sinon leurs euros manquent au total de la page');
  });
});

/* ------------------------------------------------------------------
   5. Une somme saisie à la main
   ------------------------------------------------------------------ */
suite('Somme saisie à la main', () => {

  /* `parseSomme` rend `{ total, termes }` : le total pour le calcul, les termes
     pour reconstruire le découpage `d` de la catégorie. */

  test('additionne et soustrait', () => {
    pres(parseSomme('100+50+70').total, 220, 'trois termes');
    pres(parseSomme('100 + 50').total, 150, 'les espaces ne gênent pas');
    pres(parseSomme('200-50').total, 150, 'la soustraction marche');
    pres(parseSomme('1 200,50').total, 1200.5, 'espace fin et virgule décimale');
  });

  test('rend aussi le détail des termes', () => {
    const r = parseSomme('100+50+70');
    eq(r.termes.length, 3, 'trois termes retenus');
    pres(r.termes.reduce((s, x) => s + x, 0), r.total, 'les termes refont le total');
  });

  test('un nombre seul reste un nombre', () => {
    pres(parseSomme('450').total, 450);
    pres(parseSomme('450,25').total, 450.25);
    eq(parseSomme('450').termes.length, 1, 'un seul terme, pas de découpage à garder');
  });

  test('rejette ce qui n’est pas une somme, au lieu de l’arrondir à zéro', () => {
    /* Le contrat : `null` pour une saisie invalide, et surtout pas 0. Un zéro
       silencieux écraserait le montant déjà enregistré sur une faute de
       frappe. L'appelant voit `null` et refuse la saisie.
       L'analyseur est strict et n'utilise pas `eval` — d'où le rejet de
       « 1e3 », qui est pourtant un nombre pour JavaScript. */
    for (const s of ['alert(1)', 'abc', '1;2', '((', '1+', '1e3']) {
      const r = parseSomme(s);
      eq(r, null, `parseSomme(${JSON.stringify(s)}) doit être rejeté`);
    }
  });

  test('un champ vide vaut zéro, pas un rejet', () => {
    /* Effacer un montant est une intention légitime, distincte d'une faute. */
    pres(parseSomme('').total, 0);
    pres(parseSomme('   ').total, 0);
    eq(parseSomme('').termes.length, 0, 'rien à découper');
  });

  test('les montants négatifs passent', () => {
    pres(parseSomme('-40').total, -40, 'un remboursement se saisit en négatif');
    pres(parseSomme('+5').total, 5, 'un plus initial est toléré');
  });

  });

/* ------------------------------------------------------------------
   6. L'état d'une place
   ------------------------------------------------------------------ */
suite('État d’une place de marché', () => {

  const MAINTENANT = () => Math.floor(Date.now() / 1000);
  const H = 3600;

  test('Yahoo a le dernier mot quand il se prononce', () => {
    eq(marketStatus({ marketState: 'REGULAR' }).cle, 'open');
    eq(marketStatus({ marketState: 'CLOSED' }).cle, 'close');
    eq(marketStatus({ marketState: 'PRE' }).cle, 'pre');
  });

  test('une séance bornée se lit à l’horloge', () => {
    const t = MAINTENANT();
    eq(marketStatus({ session: { regular: [t - H, t + H] } }).cle, 'open',
      'dans la séance');
    eq(marketStatus({ session: { regular: [t - 5 * H, t - 4 * H] } }).cle, 'close',
      'après la séance');
  });

  test('une fenêtre de 24 h ne dit rien : c’est le cours qui tranche', () => {
    /* Le bug : pour un future, une devise ou une crypto, Yahoo publie une
       journée calendaire et non une séance. L'or annonçait « 06:00 → 05:59 »,
       vingt-quatre heures qui contiennent forcément l'instant présent — il
       s'affichait donc ouvert un dimanche soir, avec un dernier cours vieux
       de quarante-six heures. */
    const t = MAINTENANT();
    const journee = { regular: [t - 12 * H, t + 12 * H] };
    eq(marketStatus({ session: journee, quoteTime: t - 46 * H }).cle, 'close',
      'un cours vieux de 46 h ne vient pas d’un marché qui cote');
    eq(marketStatus({ session: journee, quoteTime: t - 60 }).cle, 'open',
      'un cours d’il y a une minute, si');
  });

  test('sans rien pour trancher, on se tait', () => {
    eq(marketStatus({}), null, 'pas de session : aucune affirmation');
    const t = MAINTENANT();
    eq(marketStatus({ session: { regular: [t - 12 * H, t + 12 * H] } }), null,
      'fenêtre de 24 h sans horodatage : on ne devine pas');
  });
});

/* ------------------------------------------------------------------
   7. Les couleurs veulent dire une seule chose
   ------------------------------------------------------------------ */
suite('Une infobulle de graphique tient sous le doigt', () => {

  /* L'infobulle tient tant que le doigt reste appuye sur le graphique, meme s'il
     tremble.

     Le graphique porte `touch-action: pan-y` pour que la page reste defilable
     au-dessus de lui. Le revers : des que le doigt derive de quelques pixels vers
     le bas, le navigateur reclame le geste pour son defilement et ANNULE le
     pointeur. L'infobulle se fermerait donc au moindre tremblement, alors qu'on
     tient justement le doigt en place pour lire.

     Retirer `pan-y` reglerait ca et bloquerait la page sur toute la hauteur du
     graphique : le remede serait pire. On ignore donc l'annulation. Ce qui ferme
     reste le doigt leve, la sortie du cadre, et l'appui ailleurs -- et ce dernier
     est le garde-fou : sans lui, une infobulle survivant au defilement resterait
     a l'ecran indefiniment. */

  test('l’annulation du pointeur ne ferme pas, les autres sorties si', () => {
    const src = lireSource('assets/charts.js');
    vrai(src, 'assets/charts.js doit être lisible pour ce contrôle');

    vrai(!/addEventListener\('pointercancel', cacher\)/.test(src),
      'l’annulation du pointeur ne doit plus fermer l’infobulle : le navigateur '
      + 'l’émet dès qu’il réclame le geste pour son défilement');

    /* Le doigt garde la main sur toute la hauteur du graphique : sans capture,
       sortir du cadre par le haut ou par le bas referme, et un doigt qui tient
       une colonne de 220 px en sort tout le temps. */
    vrai(/setPointerCapture\(ev\.pointerId\)/.test(src),
      'le graphique doit capturer le pointeur : le mois ne dépend que de '
      + 'l’abscisse, la hauteur ne faisait qu’interrompre');

    /* Et ce qui ferme est le doigt leve, sans delai. Le repit de 1 400 ms partait
       d'une bonne intention — laisser le temps de lire — sur un raisonnement faux :
       on lit pendant qu'on appuie. Il coutait cher, car ce `setTimeout` n'etait
       jamais annule : deux appuis rapproches, et le minuteur du premier fermait
       l'infobulle du second. C'est la signature d'un minuteur en retard, pas d'une
       regle, et c'est ce que « la plupart du temps » decrivait. */
    vrai(/addEventListener\('pointerup', cacher\)/.test(src),
      'lever le doigt ferme, et immédiatement');
    vrai(!/setTimeout\(cacher/.test(src),
      'aucun minuteur ne doit fermer l’infobulle : non annulé, celui d’un appui '
      + 'précédent fermait celle de l’appui suivant');
    /* Le garde-fou, sans lequel l'infobulle pourrait rester a vie. */
    vrai(/document\.addEventListener\('pointerdown', ev => fermerInfobulles/.test(src),
      'un appui ailleurs doit refermer : c’est ce qui rattrape une infobulle '
      + 'qui a survécu à un début de défilement');
    /* Et la page reste defilable au-dessus du graphique. */
    vrai(/touchAction = 'pan-y'/.test(src),
      'le graphique laisse la page défiler : c’est la contrainte qui crée '
      + 'l’annulation, on l’assume au lieu de bloquer la page');
  });
});

suite('Une liste ne se rouvre pas après le choix', () => {

  /* Choisir dans une liste referme la fenetre du selecteur du premier coup, sans
     second clic.

     Le rendu du focus existe pour les champs de texte : `render()` reconstruit le
     balisage a chaque frappe, et sans lui le curseur sauterait du champ des qu'on
     tape un chiffre. Sur une liste il fait l'inverse -- on vient de choisir, le
     selecteur natif se referme, et lui rendre le focus le rouvre.

     Le `blur()` avant le rendu est la seconde moitie : sans lui, le selecteur
     natif d'iOS survit a la destruction du `<select>` qui le portait. Corriger
     l'un sans l'autre laisse la moitie du defaut. */

  test('le focus ne revient pas sur une liste, et elle se ferme avant le rendu', () => {
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');

    const i = src.indexOf('const estListe = f.tagName === \'SELECT\'');
    vrai(i > 0, 'le cas de la liste doit être distingué de celui d’un champ');
    const bloc = src.slice(i, i + 400);

    vrai(/if \(estListe\) f\.blur\(\);/.test(bloc),
      'la liste doit se fermer avant le rendu, sinon le sélecteur natif flotte '
      + 'au-dessus d’un élément détruit');
    vrai(/const path = estListe \? null :/.test(bloc),
      'et ne pas être reprise par le focus : c’est ce qui la rouvrait');

    /* Le rendu du focus reste pour tout le reste : c'est lui qui garde le curseur
       dans un champ pendant qu'on tape. */
    vrai(/again && again\.focus/.test(src),
      'un champ de texte doit toujours retrouver son focus après le rendu');
  });
});

suite('Le gel du fond s’apparie à la fenêtre, pas à l’appel', () => {

  /* Enregistrer un montant depuis un panneau d'apercu ne laisse pas le corps en
     `position: fixed` : la page ne defilerait plus, et sa hauteur figee laisserait
     en bas de l'ecran une bande que rien ne peint.

     La cause possible est un compteur desynchronise. Enregistrer depuis un
     panneau d'apercu le rouvre apres avoir enregistre -- c'est voulu, on veut voir
     le total bouger -- et le rouvrir ALORS QU'IL EST DEJA OUVERT ferait passer le
     compteur a deux : la fermeture suivante le ramenerait a un, et le fond
     resterait gele.

     Compter les appels suppose qu'ils vont par paires, ce que rien ne garantit.
     La fenetre porte donc sa propre marque : elle gele une fois et degele une
     fois, quel que soit le nombre d'appels. Le compteur garde son role -- une
     fiche qui ouvre une confirmation -- mais il ne peut plus compter deux fois la
     meme. */

  test('ouvrir deux fois la même fenêtre ne gèle qu’une fois', () => {
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');

    const ouvre = src.indexOf('function montrerModal');
    const ferme = src.indexOf('function masquerModal');
    vrai(ouvre > 0 && ferme > 0, 'les deux fonctions doivent être trouvables');

    /* La fenetre lue est plus longue depuis que le gel paie sa mise en page
       avant l'animation (9 aout) : le bloc garde s'etend sur plusieurs lignes
       et porte un commentaire. Le motif suit la structure, pas la ligne. */
    const blocOuvre = src.slice(ouvre, ouvre + 1400);
    vrai(/const dejaGelee = m\.dataset\.gele === '1'/.test(blocOuvre),
      'l’ouverture doit regarder si cette fenêtre a déjà gelé le fond');
    vrai(/if \(!dejaGelee\) \{[\s\S]*?m\.dataset\.gele = '1';[\s\S]*?gelerFond\(\);/.test(blocOuvre),
      'et ne geler qu’à la première : sinon le compteur monte sans redescendre');
    vrai(/void document\.body\.offsetHeight/.test(blocOuvre),
      'la mise en page du gel se paie avant le lever de rideau, pas pendant');
    vrai(/if \(m\.dataset\.gele === '1'\) \{ delete m\.dataset\.gele; degelerFond\(\); \}/
      .test(src.slice(ferme, ferme + 400)),
      'la fermeture doit dégeler exactement quand cette fenêtre avait gelé, et retirer sa marque');

    /* La marque et le compteur ne se remplacent pas : le compteur sert aux
       fenetres empilees, ou une fiche ouvre une confirmation par-dessus elle. */
    vrai(/modalesOuvertes\+\+ > 0/.test(src),
      'le compteur reste, pour les fenêtres empilées');
  });
});

suite('Une bande trop mince ne porte pas de trait', () => {

  /* Une poche de quelques dixiemes de pourcent du total donne une bande de
     moins d'un pixel, dont le trait se poserait exactement sur celui de la bande
     d'en dessous : deux traits colles se lisent comme un defaut de dessin.

     Le seuil est en pixels et non en pourcentage, et ce n'est pas un detail : la
     question est de savoir s'il reste de la place entre deux traits, ce qui
     depend de la hauteur du graphique autant que de la part.

     Ce que le controle protege surtout, c'est ce qui ne doit PAS disparaitre.
     La bande garde sa surface dans tous les cas, sinon le total cesserait
     d'egaler la somme de ses parts, et l'infobulle annoncerait un montant pour
     une poche absente du dessin. Seul le trait s'efface : une poche de quelques
     dizaines d'euros garde sa bande sans trait, une poche de quelques milliers
     retrouve les deux. */

  test('le trait se tait, la surface reste', () => {
    const src = lireSource('assets/charts.js');
    vrai(src, 'assets/charts.js doit être lisible pour ce contrôle');

    const i = src.indexOf('const HAUTEUR_TRAIT');
    vrai(i > 0, 'le seuil de dessin doit exister, et porter un nom');
    /* Borne sur la fin du bloc, pas sur 900 caracteres. La tranche fixe a tenu
       jusqu'au jour ou un commentaire de six lignes s'est glisse au-dessus de la
       boucle : le controle a annonce « le trait n'est pas conditionne » sur du
       code qui l'etait, simplement pousse au-dela du couperet. Le fichier lui
       meme previent contre ce genre d'ancrage — « un test ne doit dependre ni
       d'un commentaire ni d'une longueur ». */
    const fin = src.indexOf('const totalLine', i);
    vrai(fin > i, 'la boucle des bandes doit se terminer');
    const bloc = src.slice(i, fin);

    vrai(/epaisseur >= HAUTEUR_TRAIT/.test(bloc),
      'le trait doit être conditionné à l’épaisseur de la bande');
    /* Le maximum sur la periode, pas chaque point : un trait qui apparaitrait en
       juillet pour disparaitre en aout se lirait comme une donnee manquante.

       La regle a demenage dans `empiler()`, la fonction qui empile les bandes —
       le rendu et chaque image de la transition d'un perimetre a l'autre en
       demandent une geometrie, et deux ecritures du meme empilement auraient
       fini par ne plus empiler pareil. Le controle la suit : ce qui compte est
       qu'une seule ligne decide de l'epaisseur, et qu'elle prenne un maximum. */
    const pile = src.slice(src.indexOf('function empiler(valeur, topC, cles'),
                           src.indexOf('const valeurDuPoint'));
    vrai(pile.length > 200, 'la fonction d’empilement doit être trouvable');
    vrai(/epaisseur: Math\.max\(\.\.\./.test(pile),
      'l’épaisseur retenue doit être le maximum sur la période, sinon le trait '
      + 'clignoterait d’un mois à l’autre');
    eq((src.match(/epaisseur: Math\.max/g) || []).length, 1,
      'et une seule ligne la décide, sinon le dessin et la transition divergeraient');
    /* Et la surface n'est jamais conditionnee. */
    vrai(/areas\.push\(`<polygon[^`]*\$\{trait\}`\)/.test(bloc),
      'la bande doit être peinte dans tous les cas : sans elle, le total cesserait '
      + 'd’égaler la somme de ses parts');
  });
});

suite('Le tirer-pour-rafraîchir résiste au lieu de se laisser étirer', () => {

  /* « Un écran peut se tirer beaucoup trop, il faudrait une résistance qu'on
     ressent, comme Courtier A », et « le rafraîchissement se déclenche très
     facilement vu qu'il n'y a aucune résistance ».

     L'amortissement existait pourtant — mais **linéaire** : 60 % de la course du
     doigt, sans borne. Tirer deux fois plus loin descendait deux fois plus bas,
     indéfiniment. Un ratio n'est pas une résistance : il ralentit, il ne s'oppose
     jamais, et rien n'empêchait de creuser un demi-écran de vide.

     Le contrôle reconstruit la loi depuis la source et l'exécute — c'est la
     méthode de la maison quand la fonction visée ne dépend de rien. Il vérifie
     trois propriétés, et chacune répond à un mot de la demande :

     « qu'on ressent » → la réponse s'aplatit, donc doubler la course ne double
     pas la descente ; « se tirer beaucoup trop » → elle est bornée, quel que
     soit le tirage ; et le premier centimètre colle au doigt, sans quoi le geste
     paraîtrait mou au lieu de résistant. */

  const source = lireSource('assets/app.js') || '';

  function loi() {
    const m = source.match(/const COURSE_MAX = (\d+);\s*\n\s*const amorti = d => COURSE_MAX \* \(1 - Math\.exp\(-d \/ COURSE_MAX\)\);/);
    if (!m) return null;
    const M = Number(m[1]);
    return { M, f: d => M * (1 - Math.exp(-d / M)) };
  }

  test('la page résiste : la réponse s’aplatit et reste bornée', () => {
    const l = loi();
    vrai(l, 'la loi d’amortissement doit être trouvable et asymptotique');

    /* Bornee : le tirage de la capture, 660 px de doigt, ne doit pas creuser un
       demi-ecran. */
    vrai(l.f(660) <= l.M,
      `660 px de doigt donnent ${Math.round(l.f(660))} px, et ne doivent jamais dépasser ${l.M}`);
    vrai(l.f(1e6) <= l.M, 'aucune course, même absurde, ne franchit la borne');

    /* Aplatie : c'est ça, sentir une resistance. Un amortissement lineaire
       passerait les deux assertions du dessus s'il etait plafonne, et echouerait
       ici — un plafond n'est pas une resistance, c'est un mur. */
    for (const d of [40, 80, 160, 320]) {
      vrai(l.f(2 * d) < 1.8 * l.f(d),
        `doubler la course de ${d} px doit donner nettement moins du double : `
        + `${Math.round(l.f(d))} px puis ${Math.round(l.f(2 * d))}`);
    }

    /* Et le premier centimetre colle au doigt : pente initiale de 1. Sans elle le
       geste paraitrait mou des le depart, ce qui n'est pas de la resistance. */
    vrai(l.f(6) > 5.7,
      'les premiers pixels doivent suivre le doigt, sinon le geste paraît mou');
  });

  test('le rafraîchissement coûte un geste franc', () => {
    /* Il part chercher le reseau et reecrit tous les cours : il ne doit pas
       partir sur un mouvement qu'on fait aussi pour commencer a lire. Le seuil se
       mesure sur la course du doigt et non sur celle de la page, qui est desormais
       bornee et ne pourrait plus l'atteindre. */
    /* La constante porte son nom, et c'est lui qu'on vise. Le controle s'ancrait
       auparavant sur le commentaire qui la suit, parce que `app.js` compte
       plusieurs `SEUIL` — le glissement d'une ligne en porte un autre — et lire
       le premier venu, c'etait lire autre chose que ce qu'on croyait.

       Un nom unique fait le meme travail et resiste a davantage : les fichiers
       publies sortent desormais sans leurs commentaires, et un test ancre sur un
       commentaire tombait sur l'arbre publie. Viser un repere unique, jamais un
       rang, et jamais un commentaire non plus. */
    const m = source.match(/const SEUIL_RAFRAICHIR = (\d+);/);
    vrai(m, 'le seuil du tirer-pour-rafraîchir doit être trouvable par son repère');
    const seuil = Number(m[1]);
    vrai(seuil >= 150,
      `le seuil est à ${seuil} px : sous 150, le rafraîchissement part sans qu’on l’ait voulu`);

    const l = loi();
    vrai(l && seuil > l.M * 0.9,
      'et il doit dépasser la course visible de la page : atteindre le seuil demande '
      + 'alors de pousser là où ça ne donne presque plus, ce qui est la sensation cherchée');
  });
});

suite('Une couleur de donnée ne se confond pas avec une couleur de sens', () => {

  /* Les couleurs forment un seul code : une teinte de serie ne doit pas ressembler
     a une couleur qui VEUT DIRE quelque chose. Ce n'est pas une affaire de gout,
     et la mesure le montre.

     Une teinte de serie a moins de 12 degres d'une couleur de sens -- l'or des
     metaux precieux a 1 degre de l'ambre des avertissements en theme sombre, par
     exemple -- fait signifier deux choses a la meme couleur : l'oeil apprend un
     code sur un ecran, et le voit dementi sur le suivant. C'est precisement ce qui
     fait qu'une interface parait mal assortie sans qu'on sache nommer pourquoi.

     Le controle raisonne en OKLCH, ou la distance de teinte correspond a ce que
     l'oeil percoit -- en HSL, deux jaunes a 20 degres se ressemblent quand deux
     bleus a 20 degres se distinguent. Il ne juge que les series REELLEMENT
     attribuees : `TEINTE_CLASSE` les nomme, et une teinte en reserve peut dormir
     ou elle veut tant qu'aucune classe ne la porte. La liste se derive, elle ne
     se recopie pas.

     Le seuil est a 20 degres et non a 25 : avec huit classes, cinq couleurs de
     sens et la bande violette reservee a l'interface, le cercle est
     SUR-SOUSCRIT. Le meilleur arrangement trouve laisse 21 degres entre les deux
     series les plus proches et 23 de toute semantique. Descendre sous 20
     signifierait qu'on recommence a empieter. */

  const CANAUX = [[0.4122214708, 0.5363325363, 0.0514459929],
                  [0.2119034982, 0.6806995451, 0.1073969566],
                  [0.0883024619, 0.2817188376, 0.6299787005]];

  /* Teinte OKLCH d'un `#rrggbb`, en degrés. */
  function teinte(hex) {
    const h = hex.replace('#', '');
    const canal = i => {
      const v = parseInt(h.substr(i * 2, 2), 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    const rgb = [canal(0), canal(1), canal(2)];
    const [l, m, s] = CANAUX.map(k => Math.cbrt(k[0] * rgb[0] + k[1] * rgb[1] + k[2] * rgb[2]));
    const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    const deg = Math.atan2(B, A) * 180 / Math.PI;
    return { h: deg < 0 ? deg + 360 : deg, c: Math.sqrt(A * A + B * B) };
  }
  const ecart = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };

  /* Les deux thèmes se lisent dans la source : le harnais ne rend pas de DOM, et
     surtout il faut vérifier celui qui n'est pas affiché. */
  function palette(css, bloc) {
    const i = css.indexOf(bloc);
    if (i < 0) return null;
    const fin = css.indexOf('\n}', i);
    const zone = css.slice(i, fin < 0 ? i + 4000 : fin);
    const out = {};
    for (const m of zone.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)) out[m[1]] = m[2];
    return out;
  }

  const SEMANTIQUES = ['accent', 'good', 'warning', 'serious', 'critical'];
  const SEUIL = 20;

  for (const [nom, bloc] of [['sombre', '[data-theme="dark"]'], ['clair', ':root']]) {
    test(`thème ${nom} : aucune série ne se confond avec une couleur de sens`, () => {
      const css = lireSource('assets/styles.css');
      const js = lireSource('assets/store.js');
      vrai(css && js, 'les deux sources doivent être lisibles');

      const p = palette(css, bloc);
      vrai(p && p['series-1'], `le bloc ${bloc} doit porter la palette`);

      /* Les seules series qui comptent sont celles qu'une classe porte. */
      const table = js.match(/const TEINTE_CLASSE = \{[\s\S]*?\n\};/);
      vrai(table, 'TEINTE_CLASSE doit être trouvable');
      const utilisees = [...new Set([...table[0].matchAll(/:\s*(\d+)\s*,/g)].map(m => m[1]))];
      vrai(utilisees.length >= 6, 'la table doit attribuer plusieurs teintes');

      for (const n of utilisees) {
        const hex = p[`series-${n}`];
        if (!hex) continue;
        const t = teinte(hex);
        /* Un gris n'a pas de teinte perceptible : il ne peut se confondre avec
           rien, et l'exiger reviendrait a interdire les neutres. */
        if (t.c < 0.05) continue;
        for (const s of SEMANTIQUES) {
          if (!p[s]) continue;
          const d = ecart(t.h, teinte(p[s]).h);
          vrai(d >= SEUIL,
            `series-${n} (${hex}) est à ${Math.round(d)}° de --${s} (${p[s]}) en thème ${nom} : `
            + `la même couleur dirait une classe d’actif et un état. Minimum ${SEUIL}°.`);
        }
      }

      /* Et deux classes ne se distinguent pas non plus par la seule saturation. */
      for (let i = 0; i < utilisees.length; i++) {
        for (let j = i + 1; j < utilisees.length; j++) {
          const a = p[`series-${utilisees[i]}`], b = p[`series-${utilisees[j]}`];
          if (!a || !b) continue;
          const ta = teinte(a), tb = teinte(b);
          if (ta.c < 0.05 || tb.c < 0.05) continue;
          const d = ecart(ta.h, tb.h);
          vrai(d >= SEUIL,
            `series-${utilisees[i]} (${a}) et series-${utilisees[j]} (${b}) sont à `
            + `${Math.round(d)}° en thème ${nom} : sur un même graphique, l’une se lit `
            + `comme l’autre en version délavée. Minimum ${SEUIL}°.`);
        }
      }
    });
  }
});

suite('Les couleurs de classes ne se marchent pas dessus', () => {

  test('deux classes distinctes ont deux teintes distinctes', () => {
    /* Le bug : deux tables de couleurs écrites à la main avaient divergé. Les
       métaux précieux partageaient `series-4` avec l'immobilier — dans
       « Allocation par actif », un studio et un ETC or se peignaient de la
       même couleur. */
    const classes = ['liquidites', 'actions', 'obligations', 'crypto', 'nonCote',
                     'immobilier', 'metaux'];
    const vues = new Map();
    for (const c of classes) {
      const teinte = couleurClasse(c);
      if (vues.has(teinte))
        throw new Error(`« ${c} » et « ${vues.get(teinte)} » partagent ${teinte}`);
      vues.set(teinte, c);
    }
  });

  test('la table dérivée dit la même chose que la table source', () => {
    for (const c of ['liquidites', 'actions', 'obligations', 'crypto', 'nonCote', 'immobilier'])
      eq(CLASSE_COULEURS[c], couleurClasse(c), `CLASSE_COULEURS.${c} doit suivre couleurClasse()`);
  });

  test('une classe inconnue ne rend pas une couleur par défaut trompeuse', () => {
    eq(CLASSE_COULEURS.inexistante, undefined,
      'les appelants doivent pouvoir écrire « || CLASSE_COULEURS.nonCote »');
  });
});

finDePartieDeTests('tests/02-ce-qui-change-entre.tests.js');
