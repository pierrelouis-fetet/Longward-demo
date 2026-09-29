partieDeTests('tests/16-performance-jour-se-compte.tests.js');
/* ------------------------------------------------------------------
   Marches : un seul denominateur pour la carte du jour
   ------------------------------------------------------------------ */
suite('La performance du jour se compte sur le portefeuille entier', () => {

  /* Poids, part et effet avaient adopte une convention -- titres plus cash a
     investir -- et le pourcentage du jour avait garde la sienne : la valeur
     d'hier des seules lignes ayant cote. Trois colonnes et un total se
     divisaient par deux denominateurs differents sur la meme carte. */

  /* Un portefeuille rond : 16 000 de titres apres une baisse de 100, et 4 000 de
     cash a investir. Le cours de veille se pose a la main pour que la variation
     du jour soit exactement celle qu'on veut. */
  const portefeuille = (titres, cash, varJour) => e => {
    const prixVeille = (titres - varJour) / 100;
    e.positions = [{ id: 'p1', name: 'ETF', isin: '', symbol: 'X', currency: 'EUR',
      qty: 100, buyPrice: prixVeille, price: titres / 100, prevClose: prixVeille,
      fx: 1, fxBuy: 1, account: 'c_cto', manual: false,
      assetClass: 'actions', role: 'core' }];
    e.comptes = [{ id: 'c_cto', etabId: 'e_c', type: 'cto', statut: 'ouvert',
      libelle: 'CTO', court: 'CTO', numero: '', notes: '', alloc: '',
      ouvertLe: '2020-01-01', lignes: [],
      cash: cash ? [{ montant: cash, affectation: 'investir' }] : [] }];
    e.etabs = [{ id: 'e_c', nom: 'Courtier', notes: '', dettes: [] }];
    e.monthly = [];
  };

  test('le cash entre dans la base, et le pourcentage baisse d’autant', () => {
    Fixture.poser(portefeuille(16000, 4000, -100));
    const j = dayPerformance();
    pres(j.eur, -100, 'la variation du jour vaut cent euros de moins');
    pres(basePortefeuilleMarches(), 20000, 'le portefeuille vaut vingt mille');
    pres(j.base, 20100, 'la base est le portefeuille tel qu’il était ce matin');
    pres(j.pct, -100 / 20100 * 100, 'donc environ un demi-point de baisse');
    vrai(Math.abs(j.pct + 0.5) < 0.01, 'soit −0,50 % à l’arrondi de l’affichage');
    /* Et non les -0,625 % de la seule poche investie, qu'aucune ligne de
       l'ecran ne nomme. */
    vrai(Math.abs(j.pct - (-100 / 16100 * 100)) > 0.1,
      'et non le pourcentage de la seule poche investie');
  });

  test('la somme des effets s’accorde avec le pourcentage affiché', () => {
    /* La coherence demandee : chaque ligne porte son effet en euros, leur somme
       est le numerateur, et le denominateur est celui des poids. Poids x
       variation redonne donc l'effet, a l'arrondi pres. */
    Fixture.poser(portefeuille(16000, 4000, -100));
    const j = dayPerformance();
    pres(j.lignes.reduce((s, l) => s + l.eur, 0), j.eur,
      'la somme des effets est exactement le total du jour');
    pres(j.eur / j.base * 100, j.pct, 'et ce total sur la base fait le pourcentage');
    /* Le poids d'une ligne se lit sur la meme base que la performance. */
    const l = j.lignes[0];
    pres(poidsPortefeuille(l.value), 16000 / 20000 * 100,
      'le poids de la ligne se lit sur le portefeuille entier');
    /* Poids x variation = contribution, en points de pourcentage. */
    const contribution = poidsPortefeuille(l.value) / 100 * l.pct;
    vrai(Math.abs(contribution - j.pct) < 0.02,
      'poids × variation redonne la performance globale, à l’arrondi près');
  });

  test('un portefeuille sans cash retrouve l’ancien calcul', () => {
    /* La convention ne change rien pour qui n'a pas de cash en attente : c'est
       la preuve que le cash est la seule difference. */
    Fixture.poser(portefeuille(16000, 0, -100));
    const j = dayPerformance();
    pres(j.base, 16100, 'la base est la valeur d’hier des titres');
    pres(j.base, j.baseCotees, 'et elle vaut celle des lignes cotées');
    pres(j.pct, -100 / 16100 * 100, 'le pourcentage est celui de la poche investie');
  });

  test('un portefeuille tout en cash ne rend ni NaN ni Infinity', () => {
    Fixture.poser(e => {
      portefeuille(0, 5000, 0)(e);
      e.positions = [];
    });
    const j = dayPerformance();
    pres(j.eur, 0, 'rien n’a bougé');
    pres(j.base, 5000, 'la base est le cash');
    pres(j.pct, 0, 'et le pourcentage vaut zéro, pas une division impossible');
    eq(j.lignes.length, 0, 'aucune ligne à lister');
  });

  test('un portefeuille vide rend zéro plutôt qu’une division par zéro', () => {
    Fixture.poser(e => { e.positions = []; e.comptes = []; e.etabs = []; e.monthly = []; });
    const j = dayPerformance();
    pres(j.base, 0, 'aucune base');
    pres(j.pct, 0, 'zéro pour cent, et non NaN');
    vrai(Number.isFinite(j.pct), 'le nombre reste fini');
  });

  test('une ligne sans cours de veille n’entre dans aucun des deux termes', () => {
    /* Rien n'est invente : sans cloture de reference, la ligne se compte a part
       et n'apparait ni au numerateur ni dans la liste. Elle reste dans la base,
       parce qu'elle fait partie du portefeuille -- et c'est justement pourquoi
       la carte annonce leur nombre. */
    Fixture.poser(e => {
      portefeuille(16000, 4000, -100)(e);
      e.positions.push({ id: 'p2', name: 'Sans cours', isin: '', symbol: 'Y',
        currency: 'EUR', qty: 10, buyPrice: 100, price: 100, fx: 1, fxBuy: 1,
        account: 'c_cto', manual: false, assetClass: 'actions', role: 'satellite' });
    });
    const j = dayPerformance();
    eq(j.sansDonnee, 1, 'la ligne sans référence se compte à part');
    eq(j.lignes.length, 1, 'et ne figure pas dans la liste');
    pres(j.eur, -100, 'elle n’ajoute rien au numérateur');
    pres(basePortefeuilleMarches(), 21000, 'mais elle est dans le portefeuille');
    pres(j.base, 21100, 'donc dans la base du pourcentage');
  });

  test('la note dit sur quoi porte le pourcentage', () => {
    const src = lireSource('assets/app.js');
    vrai(/sur ton portefeuille Marchés depuis la clôture d’hier/.test(src),
      'la note nomme le portefeuille Marchés');
    vrai(!/sur tes lignes de titres depuis la clôture/.test(src),
      'et non plus les seules lignes de titres, qui décrivaient l’ancienne base');
    vrai(!(lireSource('assets/i18n.js') || '')
      .includes('sur tes lignes de titres depuis la clôture'),
      'la clef de l’ancienne note est partie avec elle');
  });
});

suite('Projection tient sur quatre hypothèses', () => {

  /* La direction prise etait mauvaise, et vite : une hypothese par classe
     d'actif. Actions, obligations, crypto, metaux, immobilier cote,
     multi-actifs, non cote. Dix rendements theoriques presentes comme de la
     finesse alors qu'aucun n'est connu, et un ecran qui demande a son lecteur
     de devenir analyste avant de lire une courbe.

     Quatre poches :

       Actifs de marche   le portefeuille cote, au taux du scenario
       Autres actifs      crypto, metaux precieux, non cote -- 0 % par defaut
       Capital garanti    son taux de scenario
       Liquidites         0 %, sans reglage

     Le taux du marche est une hypothese GLOBALE sur un portefeuille cote, et
     l'assumer est plus honnete que de trancher sept fois au hasard. Zero sur
     « autres actifs » ne dit pas qu'ils ne rapporteront rien : il dit que
     l'application n'en suppose aucune revalorisation. */

  /* Un patrimoine ou chaque poche est nette et ronde. Le compte de titres porte
     un ETF et de l'or, le portefeuille porte du bitcoin, l'assurance-vie du non
     cote : les trois familles que « autres actifs » regroupe, moins une, plus
     celle qui reste au marche. */
  const quatrePoches = e => {
    /* `manual: false` : posValue() lit alors quantite x cours, et c'est ce que
       le fixture fait. En manuel il lirait `value`, absent ici, donc zero. */
    e.positions = [
      { id: 'p_etf', name: 'ETF Monde', isin: '', symbol: 'EWLD', currency: 'EUR',
        qty: 100, buyPrice: 150, price: 200, fx: 1, fxBuy: 1, account: 'c_cto',
        manual: false, assetClass: 'actions', role: 'core' },
      { id: 'p_or', name: 'Or physique', isin: '', symbol: 'GOLD', currency: 'EUR',
        qty: 10, buyPrice: 180, price: 200, fx: 1, fxBuy: 1, account: 'c_cto',
        manual: false, assetClass: 'metaux', role: 'satellite' },
    ];
    e.comptes = [
      { id: 'c_cto', etabId: 'e_courtier', type: 'cto', statut: 'ouvert',
        libelle: 'CTO', court: 'CTO', numero: '', notes: '', alloc: '',
        ouvertLe: '2020-01-01', cash: [], lignes: [] },
      { id: 'c_wallet', etabId: 'e_courtier', type: 'crypto', statut: 'ouvert',
        libelle: 'Wallet', court: 'Wallet', numero: '', notes: '', alloc: '',
        ouvertLe: '2021-01-01', cash: [],
        lignes: [{ id: 'l_btc', classe: 'crypto', libelle: 'BTC', valeur: 3000,
                   prixDeRevient: 3000, quantite: 1, dateAcquisition: '' }] },
      { id: 'c_av', etabId: 'e_courtier', type: 'av', statut: 'ouvert',
        libelle: 'Assurance-vie', court: 'AV', numero: '', notes: '', alloc: '',
        ouvertLe: '2019-01-01', cash: [],
        lignes: [{ id: 'l_pe', classe: 'nonCote', libelle: 'Parts', valeur: 5000,
                   prixDeRevient: 5000, quantite: 1, dateAcquisition: '' }] },
    ];
    e.etabs = [{ id: 'e_courtier', nom: 'Courtier', notes: '', dettes: [] }];
    e.monthly = [];
    e.meta.projMonthly = 0;
    e.meta.projInflation = 0;
    e.meta.projTarget = 0;
    e.meta.projScenario = 'central';
  };

  test('crypto, métaux et non coté font une seule poche', () => {
    /* Le regroupement demande, au chiffre : 3 000 de crypto, 2 000 d'or,
       5 000 de non cote font 10 000 d'autres actifs, et le portefeuille cote
       garde ses 20 000. */
    Fixture.poser(quatrePoches);
    const q = pochesProjection();
    pres(q.marche, 20000, 'l’ETF reste seul dans les actifs de marché');
    pres(valeurMetaux(), 2000, 'l’or se compte à part');
    pres(q.autres, 3000 + 2000 + 5000,
      'crypto, métaux et non coté sont ensemble dans « autres actifs »');
    vrai(q.marche !== 22000,
      'et l’or n’est plus dans la poche du marché, où il prenait 6 % l’an');
  });

  test('les métaux quittent le marché sans quitter les autres écrans', () => {
    /* La frontiere ne bouge QUE dans la projection. `nowByGroup().bourse` range
       toujours l'or avec les actions, parce qu'un ETC or se vend en seance comme
       un ETF, et Allocation, l'autonomie financiere et l'historique en dependent.
       Deplacer la classe elle-meme aurait casse ces trois ecrans. */
    Fixture.poser(quatrePoches);
    pres(num(nowTotals().bourse), 22000,
      'l’accueil compte toujours l’or avec les titres cotés');
    pres(patrimoine().classes.actions, 22000,
      'et Allocation le classe toujours en actifs de marché');
    const q = pochesProjection();
    pres(q.marche + valeurMetaux(), num(nowTotals().bourse),
      'la projection le retire, et le retire d’un seul côté');
  });

  test('le patrimoine initial ne bouge pas d’un centime', () => {
    /* Le point qui compte : les frontieres se deplacent, le total non. Ni perte,
       ni doublon. 20 000 + 10 000 des deux cotes. */
    Fixture.poser(quatrePoches);
    const q = pochesProjection();
    pres(q.placees, 20000 + 10000, 'les poches font le patrimoine placé');
    pres(q.placees + q.plat, patrimoine().net,
      'et avec la part plate, le patrimoine net entier');
    const c = configProjection({ years: 10 });
    pres(c.start, q.placees, 'la base qui capitalise les compte toutes');
    pres(c.marche + c.autres + c.garanti + c.liquidites, c.start,
      'la somme des départs égale cette base');
  });

  test('scénario central : 6 %, 0 %, 2,5 %, 0 %', () => {
    /* Les quatre valeurs demandees, lues sur la table et non recopiees ici. */
    Fixture.poser(quatrePoches);
    const c = configProjection({ years: 10 });
    pres(c.rate, 6, 'six pour cent sur les actifs de marché');
    pres(c.rateAutres, 0, 'zéro sur les autres actifs');
    pres(c.rateGaranti, 2.5, 'deux et demi sur le capital garanti');
    const m = moteurProjection(c);
    pres(m.final.poches.marche, 20000 * Math.pow(1.06, 10),
      'l’ETF suit son taux');
    pres(m.final.poches.autres, 10000,
      'la poche des autres actifs traverse la projection telle quelle');
    pres(m.final.total,
      Object.values(m.final.poches).reduce((s, x) => s + x, 0),
      'et le total égale la somme des poches');
  });

  test('dix mille euros d’autres actifs restent dix mille euros', () => {
    /* La propriete demandee mot pour mot, sur l'etat reel et non sur une
       configuration forgee : sans versement, plusieurs annees plus tard, la
       poche vaut nominalement ce qu'elle valait. Pas de derive d'arrondi. */
    Fixture.poser(quatrePoches);
    for (const ans of [1, 10, 30]) {
      pres(capitalisation({ years: ans }).points[ans].poches.autres, 10000,
        `${ans} an(s) plus tard, toujours dix mille euros`);
    }
  });

  test('un taux personnalisé s’applique à toute la poche, et à elle seule', () => {
    /* Autres actifs a 5 % : les 10 000 entiers suivent ce taux — crypto, or et
       non cote ensemble — et le marche ne bouge pas d'un centime. */
    Fixture.poser(e => {
      quatrePoches(e);
      e.meta.projScenario = 'perso';
      e.meta.projRate = 6; e.meta.projRateAutres = 5; e.meta.projRateGaranti = 2.5;
    });
    const m = moteurProjection(configProjection({ years: 10 }));
    pres(m.final.poches.autres, 10000 * Math.pow(1.05, 10),
      'les trois familles suivent le même cinq pour cent');
    pres(m.final.poches.marche, 20000 * Math.pow(1.06, 10),
      'et le marché garde les siens');
    pres(m.final.gainsAutres, 10000 * Math.pow(1.05, 10) - 10000,
      'le gain de la poche est celui de son taux');
  });

  test('les anciens réglages par classe rejoignent la poche unique', () => {
    /* La migration. Un etat ecrit quand la crypto avait son propre taux porte
       `projRateCrypto`. Il n'y a plus qu'une poche : ce taux la rejoint, et la
       clef s'en va.

       La regle : `projRateAutres` gagne quand il porte une valeur. Prendre le
       plus eleve aurait releve la courbe de quelqu'un sans qu'il l'ait demande.

       Et rien d'autre ne bouge : le marche, le garanti et le versement gardent
       ce qu'ils avaient. */
    Fixture.poser(e => {
      quatrePoches(e);
      e.meta.projScenario = 'perso';
      e.meta.projRate = 7; e.meta.projRateGaranti = 2;
      e.meta.projRateCrypto = 10;
      delete e.meta.projRateAutres;
    });
    Store.migrate();
    eq(Store.state.meta.projRateCrypto, undefined, 'la clef de la crypto s’en va');
    pres(projectionSettings().rateAutres, 10,
      'et son taux devient celui de la poche, plutôt que d’être perdu');
    pres(projectionSettings().rate, 7, 'le marché garde ses sept');
    pres(projectionSettings().rateGaranti, 2, 'le garanti ses deux');

    /* Deux taux pour une poche unique : celui qui etait deja general gagne. */
    Fixture.poser(e => {
      quatrePoches(e);
      e.meta.projScenario = 'perso';
      e.meta.projRateAutres = 3; e.meta.projRateCrypto = 10;
    });
    Store.migrate();
    pres(projectionSettings().rateAutres, 3,
      'le taux déjà général l’emporte : la courbe de personne ne monte toute seule');

    /* Idempotente sans drapeau : la clef effacee ne peut plus se reecrire. */
    Store.migrate();
    pres(projectionSettings().rateAutres, 3, 'et deux passes donnent le même état');

    /* Un etat qui n'a jamais connu ces champs part de zero. */
    Fixture.poser(e => {
      quatrePoches(e);
      e.meta.projScenario = 'perso';
      e.meta.projRate = 7;
      delete e.meta.projRateAutres;
    });
    Store.migrate();
    pres(projectionSettings().rateAutres, 0,
      'sans rien d’affirmé, les autres actifs partent de zéro');
  });

  test('une destination de versement disparue rejoint la poche qui la remplace', () => {
    /* `projVersementVers` a pu valoir « crypto » ou « nonCote ». Ces poches
       n'existent plus : sans migration, `repartitionVersement` retombe sur le
       marche et l'argent de quelqu'un change de destination en silence. */
    for (const ancienne of ['crypto', 'nonCote']) {
      Fixture.poser(e => { quatrePoches(e); e.meta.projVersementVers = ancienne; });
      Store.migrate();
      eq(Store.state.meta.projVersementVers, 'autres',
        `« ${ancienne} » devient « autres »`);
      pres(repartitionVersement().autres, 1, 'et le versement y va entier');
    }
    /* Une destination toujours valable ne bouge pas. */
    Fixture.poser(e => { quatrePoches(e); e.meta.projVersementVers = 'garanti'; });
    Store.migrate();
    eq(Store.state.meta.projVersementVers, 'garanti', 'le garanti reste le garanti');
  });

  test('un versement vers les autres actifs s’y accumule à plat', () => {
    Fixture.poser(e => {
      quatrePoches(e);
      e.meta.projVersementVers = 'autres';
      e.meta.projMonthly = 100;
    });
    const f = repartitionVersement();
    pres(f.autres, 1, 'tout le versement y va');
    pres(Object.values(f).reduce((s, x) => s + x, 0), 1, 'et les parts font un');
    const m = moteurProjection(configProjection({ years: 10 }));
    pres(m.final.poches.autres, 10000 + 100 * 120,
      'à taux nul, cent euros par mois pendant dix ans s’y accumulent à plat');
    pres(m.final.poches.marche, 20000 * Math.pow(1.06, 10),
      'et le marché ne reçoit rien');
  });

  test('l’inflation ne change pas de comportement', () => {
    /* Elle se retire une fois, sur le total, comme avant : la refonte des poches
       ne la touche pas. */
    Fixture.poser(e => { quatrePoches(e); e.meta.projInflation = 2; });
    const m = moteurProjection(configProjection({ years: 20 }));
    pres(m.final.poches.autres, 10000, 'nominalement, la poche n’a pas bougé');
    pres(m.final.real, m.final.total / Math.pow(1.02, 20),
      'et le réel vaut le nominal déflaté, sans autre correction');
  });

  test('Projection ne demande aucun rendement par classe d’actif', () => {
    /* Le controle qui garde la direction. Trois taux reglables, et pas un de
       plus : marche, autres actifs, garanti. Ni actions, ni obligations, ni
       crypto, ni or, ni immobilier cote, ni REIT, ni private equity.

       Allocation, elle, a le droit d'etre bien plus fine : elle dit comment le
       patrimoine est reparti, quand Projection dit ce qu'il pourrait devenir
       avec quelques hypotheses simples. Deux questions, deux granularites, et
       c'est volontaire. */
    eq(TAUX_PROJECTION.length, 3, 'trois taux réglables, et pas un de plus');
    for (const chemin of TAUX_PROJECTION) {
      vrai(['meta.projRate', 'meta.projRateAutres', 'meta.projRateGaranti']
        .includes(chemin), `« ${chemin} » n’est pas un des trois`);
    }
    const src = lireSource('assets/store.js') + lireSource('assets/app.js');
    for (const interdit of ['projRateActions', 'projRateObligations', 'projRateOr',
                            'projRateMetaux', 'projRateImmoCote', 'projRateReit',
                            'projRatePrivateEquity', 'projRateNonCote',
                            'projRateDiversifie']) {
      vrai(!src.includes(interdit),
        `« ${interdit} » : Projection ne pose pas d’hypothèse par classe d’actif`);
    }
    /* Et la seule survivance de l'essai par classe est sa migration, qui existe
       pour effacer la clef. */
    const store = lireSource('assets/store.js');
    const mentions = (store.match(/projRateCrypto/g) || []).length;
    vrai(mentions > 0 && mentions <= 4,
      'projRateCrypto ne vit plus que dans la migration qui l’efface');
    /* Chaque scenario porte exactement les quatre colonnes des quatre poches. */
    for (const [cle, , taux] of SCENARIOS_PROJECTION) {
      eq(Object.keys(taux).sort().join(','), 'autres,garanti,liquidites,marche',
        `« ${cle} » déclare les quatre poches, ni plus ni moins`);
    }
  });

  test('la configuration du moteur porte exactement les clefs attendues', () => {
    /* Une poche renommee laisse derriere elle des lecteurs qui interrogent
       l'ancien nom. `targetRequirements` sommait `base.nonCote` : la clef
       disparue rendait `undefined`, la somme devenait NaN, la comparaison
       echouait, et l'ecran annonçait « cible non atteignable » a quelqu'un qui
       l'avait deja depassee. Un NaN ne leve rien et ne se voit pas.

       La liste est donc epinglee. Renommer une poche fera tomber ce controle, et
       celui qui le repare ira relire les lecteurs un par un — c'est exactement
       ce qu'on veut de lui. */
    Fixture.poser();
    const c = configProjection({ years: 10 });
    eq(Object.keys(c).sort().join(' '),
      ['dettes', 'fractions', 'garanti', 'inflation', 'liquidites', 'marche',
       'mois', 'monthly', 'autres', 'plat', 'poches', 'rate', 'rateAutres',
       'rateGaranti', 'settings', 'start', 'target'].sort().join(' '),
      'les clefs de la configuration, une par une');
    eq(Object.keys(c.fractions).sort().join(' '), 'autres garanti liquidites marche',
      'une fraction de versement par poche, et pas une de plus');
    /* Les quatre poches du moteur et celles de la table des destinations sont
       les memes : c'est ce qui garantit qu'un versement trouve toujours sa
       poche. */
    eq(VERSEMENT_VERS.map(([k]) => k).sort().join(' '),
      Object.keys(c.fractions).sort().join(' '),
      'les destinations offertes sont les poches du moteur');
    /* Et le point de sortie rend la valeur de chacune, plus la part plate. */
    const j = moteurProjection(c).final;
    eq(Object.keys(j.poches).sort().join(' '),
      'autres garanti liquidites marche plat',
      'chaque poche a sa valeur à l’horizon');
    pres(Object.values(j.poches).reduce((s, x) => s + x, 0), j.total,
      'et leur somme fait le total');
  });

  test('le dépliant des hypothèses tient en quatre champs', () => {
    /* Quatre reglages, et la ligne figee des liquidites, qui ne demande rien et
       dit ce que la projection fait d'un livret. Le premier niveau, lui, garde
       ses quatre commandes : versement, affectation, scenario, cible. */
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewObjective'),
                          src.indexOf('function mountObjective'));
    /* Le depliant, borne des deux cotes : « Cible » vit APRES lui, au premier
       niveau, donc un simple `index > pli` la comptait dedans. */
    const pli = vue.indexOf('pli-avance');
    const finDuPli = vue.indexOf('</details>', pli);
    vrai(pli > 0 && finDuPli > pli, 'le dépliant doit être trouvable, et fermé');
    const champs = [...vue.matchAll(/\$\{champ\('([^']+)'/g)].map(m => [m[1], m.index]);
    const dansLePli = champs.filter(([, i]) => i > pli && i < finDuPli).map(([nom]) => nom);
    eq(dansLePli.join(' | '),
      'Rendement des actifs de marché | Rendement des autres actifs '
      + '| Rendement du capital garanti | Inflation',
      'quatre champs dans le dépliant, dans cet ordre');
    /* Aucun champ de taux au premier niveau. */
    for (const [nom, i] of champs) {
      if (i > pli && i < finDuPli) continue;
      vrai(!/^Rendement/.test(nom),
        `« ${nom} » : aucun rendement ne remonte au premier niveau`);
    }
    /* La ligne des liquidites reste, sans devenir un menu. */
    vrai(/Rendement des liquidités'\)\}\$\{aide\(/.test(vue.replace(/\s+/g, ''))
      || vue.includes("trad('Rendement des liquidités')"),
      'les liquidités se disent encore, pour que le silence ne laisse pas deviner');
    vrai(!/champ\('Rendement des liquidités'/.test(vue),
      'mais sans menu : zéro n’est pas une hypothèse ici, c’est ce qu’un compte non rémunéré fait');
  });

  test('l’infobulle du marché ne classe plus les actifs', () => {
    /* Elle enumerait « actions, obligations, immobilier cote, multi-actifs,
       metaux precieux et crypto : tout ce qui se vend sur un marche ». Elle
       melangeait la classification du patrimoine et le decoupage de la
       projection, et se trompait des que l'une des deux bougeait. */
    const src = lireSource('assets/app.js');
    vrai(!/tout ce qui se vend sur un marché/.test(src),
      'la définition par la négociabilité s’en va');
    vrai(/de portefeuille financier coté, auquel Longward applique le rendement du scénario/
      .test(src), 'la poche se dit par ce qu’elle est');
    /* La pierre papier a rejoint cette poche : l'enumeration doit la nommer,
       sinon elle decrit une poche qui n'est plus celle du calcul. */
    vrai(/de crypto, de métaux précieux, de non coté et de pierre papier/.test(src),
      'et l’autre poche dit ce qu’elle regroupe');
    vrai(/aucun rendement de SCPI ne s’invente ici/.test(src),
      'et dit pourquoi elle reste constante');
    /* La bulle voisine, celle du marche, enumere la MEME poche pour dire ou va
       ce qu'elle ne couvre pas. Deux enumerations d'un seul ensemble : les
       corriger separement, c'est en oublier une. */
    vrai(/La crypto, les métaux précieux, le non coté et la pierre papier sont regroupés/
      .test(src), 'et la bulle du marché renvoie vers la même poche, entière');
  });
});

suite('Un identifiant ne se porte qu’une fois', () => {

  test('aucun conteneur de graphique n’est en double', () => {
    /* Une greffe a laisse deux `<div class="chart" id="aAsset">` cote a cote.
       `Charts.mount()` cible par identifiant : il n'en trouve qu'un, et le
       second reste un vide de la hauteur d'un graphique -- sans erreur, sans
       trace dans la console, et le seul symptome est un trou dans une carte.

       Douze conteneurs, douze identifiants distincts : la convention tient dans
       toute l'application, et ce controle la garde. */
    const src = lireSource('assets/app.js');
    const ids = [...src.matchAll(/class="chart[^"]*"\s+id="([^"]+)"/g)].map(m => m[1]);
    vrai(ids.length >= 10,
      `les conteneurs doivent etre trouvables (${ids.length} vus)`);
    const vus = new Map();
    const doubles = [];
    for (const id of ids) {
      if (vus.has(id)) doubles.push(id); else vus.set(id, true);
    }
    eq(doubles.join(', '), '',
      'un conteneur en double laisse un vide de la hauteur d’un graphique');
  });

  test('chaque conteneur est monté, et chaque montage a son conteneur', () => {
    /* L'autre moitie du meme accident : un conteneur que personne ne remplit. Il
       se lit comme un graphique absent, et il ne leve aucune erreur.

       Le sens inverse ne se teste pas ici : `$('#...')` sert a tout dans ce
       fichier -- le corps d'une fenetre, la vue, un total -- donc comparer tous
       ses selecteurs aux seuls conteneurs de graphiques crierait sur trente
       identifiants parfaitement legitimes. */
    const src = lireSource('assets/app.js');
    const poses = new Set([...src.matchAll(/class="chart[^"]*"\s+id="([^"]+)"/g)].map(m => m[1]));
    const vises = new Set([...src.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)].map(m => m[1]));
    const orphelins = [...poses].filter(id => !vises.has(id));
    eq(orphelins.join(', '), '', 'ces conteneurs existent mais rien ne les remplit');
  });
});

suite('Le « ? » d’une aide ne tombe jamais seul sur une ligne', () => {

  /* Mesure a l'ecran : sur une colonne de 208 px, « Moyenne mensuelle du
     patrimoine » tient sur une ligne et son badge passe a la suivante, seul.
     Quinze largeurs de colonne produisaient le cas sur les deux seuls intitules
     de cette carte. Une ligne entiere pour un signe de quinze pixels, et ca se
     lit comme un defaut d'affichage.

     Ni une espace insecable ni un liant (U+2060) n'y changent rien : le badge est
     une boite atomique, et le navigateur coupe devant elle parce qu'elle ne tient
     pas, non parce qu'une espace le lui permet. Ce qui marche est de rendre le
     dernier mot et le badge indissociables.

     Apres correction : 36 badges sur onze vues, tous colles, aucun orphelin,
     aucun debordement horizontal a 375 px. */

  test('le collage s’applique à la sortie du rendu, pas à chaque appel', () => {
    const src = lireSource('assets/app.js');
    /* Le collage enveloppe le rendu, dans la garde qui attrape une vue qui echoue. */
    vrai(/html = collerAides\(v\.render\(\)\); \}[\s\S]{0,400}host\.innerHTML = html;/.test(src),
      'les vues passent par le collage : un intitulé ajouté demain en hérite');
    vrai(/\$\('#modalBody'\)\.innerHTML = collerAides\(/.test(src),
      'et les panneaux d’aperçu aussi, qui portent des intitulés eux aussi');
    /* 81 appels a aide() : les envelopper un a un aurait laisse passer le 82e. */
    vrai((src.match(/\$\{aide\(/g) || []).length > 40,
      'le nombre d’appels justifie de traiter la sortie plutôt que les appels');
  });

  test('les deux motifs sont des littérales, jamais construites depuis une chaîne', () => {
    /* `new RegExp('([^\\s<>]+)')` demande trois niveaux d'echappement : le
       fichier, la chaine JavaScript, la regex. Un niveau perdu donne `[^s<>]`,
       une classe qui exclut la lettre « s » -- elle ne matche rien d'utile et ne
       leve aucune erreur. C'est arrive, et rien ne l'a signale sauf la mesure a
       l'ecran : zero badge colle sur trente-six. */
    const src = lireSource('assets/app.js');
    vrai(/const MOTIF_AIDE_COLLEE = \/\(\[\^\\s<>\]\+\)/.test(src),
      'le motif du texte nu est une littérale');
    vrai(/const MOTIF_AIDE_GRAS = \/<b>\(\[\^<\]\*\?\)\(\\S\+\)/.test(src),
      'celui des intitulés en gras aussi');
    vrai(!/new RegExp\([^)]*aide/.test(src),
      'et aucun des deux ne se construit depuis une chaîne');
  });

  test('le groupe insécable reste un emboîtement valide', () => {
    /* Un groupe qui ouvrirait dans le `<b>` et fermerait dehors serait du
       balisage casse, repare differemment selon le navigateur. Le badge entre
       donc DANS le gras, avec le dernier mot. */
    const src = lireSource('assets/app.js');
    vrai(/`<b>\$\{debut\}<span class="aide-collee">\$\{mot\}\$\{badge\}<\/span><\/b>`/.test(src),
      'le groupe vit à l’intérieur du <b>, pas à cheval sur lui');
    const css = lireSource('assets/styles.css');
    vrai(/\.aide-collee \{[^}]*white-space: nowrap/.test(css),
      'et la classe fait ce qu’elle promet');
  });
});

suite('Un réglage montre ce qu’il commande', () => {

  /* Scenario « Dynamique », 8 % ecrits sur son pave, et « Rendement des actifs
     de marche : 0 % par an » dans le champ juste en dessous. Les deux etaient
     vrais chacun de son cote : le pave disait le scenario, le champ lisait
     `meta.projRate`, reste a zero. Le moteur, lui, prenait bien 8 %.

     Un reglage qui montre autre chose que ce qu'il commande n'est pas un
     reglage, c'est un piege : on croit lire une valeur inactive, on la corrige,
     et c'est autre chose qui bouge. */

  test('les trois champs de taux reçoivent la valeur en vigueur', () => {
    const src = lireSource('assets/app.js');
    for (const [champ, attendu] of [
      ["champ('Rendement des actifs de marché'", 's.rate)}'],
      ["champ('Rendement des autres actifs'", 's.rateAutres)}'],
      ["champ('Rendement du capital garanti'", 's.rateGaranti)}'],
    ]) {
      const d = src.indexOf(champ);
      vrai(d > 0, `${champ} doit être trouvable`);
      const bloc = src.slice(d, src.indexOf('\n        ${', d + 10));
      vrai(bloc.includes(attendu),
        `${champ} doit recevoir ${attendu} : sans valeur passée, listeChoix lit `
        + 'l’état brut, que le scénario ignore');
    }
  });

  test('chaque scénario propose un palier qui existe dans la liste', () => {
    /* `listeChoix` ajoute la valeur courante si elle ne tombe pas sur un palier,
       donc rien ne casse — mais un scenario qui produirait « 2,7 % » ferait
       apparaitre une option isolee au milieu des rondes. Les trois scenarios
       tombent juste, et ce test le garde. */
    for (const [cle, , taux] of SCENARIOS_PROJECTION) {
      eq(taux.marche % 1, 0, `« ${cle} » : le taux de marché tombe sur un palier entier`);
      eq((taux.garanti * 2) % 1, 0, `« ${cle} » : le garanti tombe sur un demi-point`);
      vrai(taux.garanti <= 8, `« ${cle} » : le garanti tient dans la liste, qui s’arrête à 8 %`);
      vrai(taux.marche <= 20, `« ${cle} » : le marché tient dans la liste, qui s’arrête à 20 %`);
    }
  });

  test('passer en personnalisé fige les trois taux, pas seulement celui qu’on touche', () => {
    /* Le piege du correctif precedent : si les champs affichent les taux du
       scenario mais que l'etat porte encore des zeros, regler le garanti ferait
       tomber le marche de 8 % a 0 % au rendu suivant. Personne ne l'a demande,
       et la courbe change. */
    const src = lireSource('assets/app.js');
    const bloc = src.slice(src.indexOf('const tauxAvant = TAUX_PROJECTION.includes'),
                           src.indexOf("m.projScenario = 'perso';") + 30);
    vrai(bloc, 'la bascule doit être trouvable');
    vrai(/projectionSettings\(\)/.test(bloc),
      'les taux en vigueur se lisent AVANT l’écriture du champ');
    for (const champ of ['projRate', 'projRateAutres', 'projRateGaranti']) {
      vrai(bloc.includes(`m.${champ} = tauxAvant.`),
        `« ${champ} » se fige quand ce n’est pas lui qu’on modifie`);
    }
    for (const champ of ['projRate', 'projRateAutres', 'projRateGaranti']) {
      vrai(bloc.includes(`f.dataset.path !== 'meta.${champ}'`),
        `et « ${champ} » n’est jamais réécrit quand c’est lui qu’on vient de modifier`);
    }
  });

  test('le moteur ne change pas de réponse pour autant', () => {
    /* La correction est d'affichage. Le calcul prenait deja le taux du scenario,
       et il doit continuer a le prendre, quoi que porte l'etat. */
    Fixture.poser(s => {
      s.meta.projScenario = 'dynamique';
      s.meta.projRate = 0; s.meta.projRateGaranti = 0; s.meta.projRateAutres = 0;
    });
    const s = projectionSettings();
    pres(s.rate, 8, 'le scénario dynamique impose 8 %, malgré le zéro enregistré');
    pres(s.rateGaranti, 3, 'et 3 % sur le garanti');
    pres(s.rateAutres, 0, 'le non coté reste à zéro dans les trois scénarios');
  });
});

suite('Projection se lit sans explication', () => {

  /* Cinq questions qu'un nouveau venu doit trancher en dix secondes : combien il
     investit, pourquoi ce montant, ou il va, a quel rendement, et si c'est une
     prevision. Chacune a sa microcopie, et chacune est epinglee ici -- une
     phrase d'interface se supprime plus facilement qu'une fonction. */

  test('la page dit ce qu’elle fait, en texte secondaire', () => {
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf("trad('De quoi sera fait ton patrimoine')"),
                          src.indexOf("trad('Tes hypothèses')"));
    vrai(/trad\('Projette ton patrimoine '/.test(vue),
      'la phrase se lit sous le premier titre qui concerne la projection');
    vrai(/<p class="small muted"/.test(vue),
      'et en texte secondaire : `hint` n’est stylée que dans un en-tête ou un champ, '
      + 'donc elle sortait en 14 px pleine encre');
  });

  test('« simulation, pas prévision » se lit sans survol', () => {
    /* La reserve vivait dans la bulle du scenario, invisible tant qu'on ne la
       survolait pas. Elle est maintenant dans le sous-titre de la carte, donc
       avant le premier pourcentage. */
    const src = lireSource('assets/app.js');
    vrai(/trad\('Tes hypothèses'\)\}<\/h2>\s*<span class="hint">\$\{trad\('hypothèses de simulation, pas prévisions de marché'\)/
      .test(src),
      'le sous-titre de « Tes hypothèses » porte la réserve');
  });

  test('l’affectation dit ce qu’elle veut dire', () => {
    const src = lireSource('assets/app.js');
    vrai(src.includes("trad('Où va ton épargne future.')"),
      '« Affectation des versements » est juste mais abstrait : une ligne le traduit');
    /* Et quand la poche choisie ne rapporte rien, la ligne le dit : sinon taper
       sur les trois paves ne produit presque rien, sans explication. */
    vrai(src.includes('num(tauxDeDestination(s))'),
      'la ligne signale une destination sans rendement');
  });

  test('« actifs de marché » se dit sans énumérer sept classes', () => {
    /* L'infobulle enumerait les classes : « actions, obligations, immobilier
       cote, multi-actifs, metaux precieux et crypto ». Elle melangeait la
       classification du patrimoine, qui est le sujet d'Allocation, et le
       decoupage de la projection — et se trompait des que l'une des deux
       bougeait : les metaux n'y ont jamais figure avant d'y etre ajoutes, et ils
       en sont sortis le lendemain.

       Une liste tenue a la main a cote de sa source finit toujours par ne plus
       la decrire. La poche se dit donc par ce qu'elle EST, et le renvoi vers
       l'autre hypothese repond a la seule question qui se pose vraiment. */
    const src = lireSource('assets/app.js');
    const aide = (src.match(/trad\('(de portefeuille financier coté[^']*)'\)/) || [])[1] || '';
    vrai(aide, 'l’aide du rendement de marché doit décrire la poche');
    /* « ont leur propre hypothese » se lisait « chacun la sienne », ce qui
       decrivait le moteur de la veille. Une seule hypothese pour les trois, et
       la phrase la nomme. */
    vrai(/sont regroupés dans l’hypothèse « Autres actifs »/.test(aide),
      'et nommer l’hypothèse unique qui couvre ce qu’elle ne contient pas');
    vrai(!/ont leur propre hypothèse/.test(aide),
      'sans laisser croire que chacun a la sienne');
    for (const absent of ['actions', 'obligations', 'multi-actifs', 'fonds euros']) {
      vrai(!aide.includes(absent),
        `« ${absent} » : cette infobulle n’énumère plus les classes, c’est le rôle d’Allocation`);
    }
  });

  test('le détail des taux par poche reste replié', () => {
    /* Le premier niveau se limite a trois paves. Remonter le rendement des
       autres actifs, du garanti et des liquidites dans l'interface principale
       rendrait la carte illisible pour le seul cas ou l'on veut les regler. */
    const src = lireSource('assets/app.js');
    const avance = src.indexOf('pli-avance');
    for (const champ of ['Rendement des autres actifs', 'Rendement du capital garanti',
                         'Rendement des liquidités', 'Inflation']) {
      vrai(src.indexOf(`trad('${champ}'`) > avance || src.indexOf(`champ('${champ}'`) > avance,
        `« ${champ} » doit vivre après l’ouverture du repli`);
    }
  });
});

suite('Deux montants, deux noms, et le lecteur voit lequel', () => {

  /* Le probleme est de vocabulaire : « Epargne que ton budget laisse :
     2 300 € » d'un cote, « Versement mensuel : 1 650 € » de l'autre, et rien
     pour expliquer l'ecart, ferait une contradiction apparente entre deux
     chiffres justes. Un seul des deux est du cash. */

  test('« Épargne que ton budget laisse » ne nomme plus l’accumulation', () => {
    const src = lireSource('assets/app.js');
    vrai(!/Épargne que ton budget laisse/.test(src),
      'le libellé fautif a disparu : il appelait « épargne » un montant dont une '
      + 'partie rembourse une dette');
    vrai(!/= Épargne investissable/.test(src),
      '« investissable » cède la place à « capacité d’épargne », un seul nom par notion');
  });

  test('l’accumulation dit sa composition, et une seule carte la porte', () => {
    /* La ligne « Accumulation patrimoniale theorique » vivait dans « Rythme
       d'accumulation », avec sa composition en sous-titre et un lien vers la
       carte de Budget qui la calculait. Elle a sa carte a elle desormais,
       « Accumulation ce mois-ci », sur la meme page : la garder aux deux
       endroits aurait mis le meme montant deux fois sur un ecran, et son lien
       menait vers une carte qui n'existe plus.

       Le partage est celui que la page annonce : « Rythme » montre la variation
       CONSTATEE et son etalement dans le temps, « Accumulation ce mois-ci » la
       prevision tiree du budget. Deux natures, deux cartes, aucun chiffre en
       commun. */
    const src = lireSource('assets/app.js');
    /* Deux bornes fausses vivaient ici, et elles se couvraient l'une l'autre.
       Le marqueur portait une apostrophe TYPOGRAPHIQUE que la source n'a pas :
       `indexOf` rendait -1, `-1 + 1` vaut 0, donc le repli s'appliquait — une
       coupure a 4 000 caracteres, que la carte a fini par depasser. Le controle
       a alors annonce « absent » ce qui etait simplement au-dela du couperet.
       La borne est la fin reelle de la fonction. */
    const debutCarte = src.indexOf('function carteAccumulation()');
    const finCarte = src.indexOf('\n}\n', debutCarte);
    vrai(debutCarte > 0 && finCarte > debutCarte, 'la carte doit être trouvable');
    const carte = src.slice(debutCarte, finCarte);
    vrai(/trad\('= Accumulation patrimoniale'\)/.test(carte),
      'la carte porte le chiffre');
    vrai(/rec\.investable/.test(carte) && /rec\.capitalRembourse/.test(carte),
      'et ses deux composantes, capacité d’épargne et capital remboursé');
    vrai(/rec\.theoretical/.test(carte), 'le total vient du modèle, pas d’une addition refaite ici');
    /* Et « Rythme d'accumulation » ne la redit plus. */
    vrai(!/Accumulation patrimoniale théorique/.test(src),
      'la ligne dupliquée a quitté « Rythme d’accumulation »');
    vrai(!/const budgetee =/.test(src),
      'son intermédiaire est parti avec elle : un appel sans lecteur est du code mort');
    /* Et l'autre appel sans lecteur, celui de la vue Budget : la carte en etait
       la seule cliente de cet ecran. */
    /* `viewBudgetCadre` est DECLARE AVANT `viewBudget` : borner la tranche
       dessus la rendait vide, et le controle criait « introuvable » au lieu de
       mesurer quoi que ce soit. La borne est la fonction qui SUIT vraiment. */
    const vueBudget = src.slice(src.indexOf('function viewBudget(section'),
                                src.indexOf('function paliersCible('));
    vrai(vueBudget.length > 1000, 'la vue Budget doit être trouvable');
    /* Commentaires retires : celui qui explique le retrait cite la fonction, et
       un controle qui crie sur sa propre explication finit par etre desactive. */
    const codeBudget = vueBudget.replace(/\/\*[\s\S]*?\*\//g, '');
    vrai(!/savingsReconciliation\(\)/.test(codeBudget),
      'et viewBudget ne lit plus un rapprochement que plus rien n’y affiche');
  });

  test('la décomposition affichée fait exactement le total affiché', () => {
    /* La regle cardinale du projet appliquee a une phrase : les deux montants
       cites sous le total doivent le composer, sinon la ligne qui explique
       devient la ligne qui embrouille. */
    Fixture.poser(s => {
      s.budget.income = [{ label: 'Salaire', amount: 3600 }];
      s.budget.fixedCharges = [{ id: 'c1', label: 'Loyer', amount: 1150, periode: 'mois' }];
      s.budget.expenses = [{ month: '2026-01', v: { Courses: 950 }, note: '' }];
      s.etabs.find(e => e.id === 'e_bien').dettes = [
        { id: 'd', libelle: 'Prêt', montant: 150000, taux: 2, mensualite: 900, note: '' }];
    });
    const rec = savingsReconciliation();
    pres(rec.investable + rec.capitalRembourse, rec.theoretical,
      'capacité d’épargne + capital remboursé = accumulation patrimoniale');
    pres(rec.investable, rec.income - rec.fixed - rec.spend,
      'et la capacité d’épargne est bien revenus − charges − dépenses');
    vrai(rec.capitalRembourse > 0.005,
      'ce fixture porte un crédit amortissable, sinon le test ne prouve rien');
  });

  test('le versement de Projection nomme sa source, et offre le calcul', () => {
    const src = lireSource('assets/app.js');
    vrai(/trad\('Repris de ta capacité d’épargne dans Budget'\)/.test(src),
      '« Repris de ton budget » ne disait pas lequel des deux chiffres du budget');
    vrai(/data-apercu="capaciteEpargne"/.test(src),
      'un accès au détail du calcul existe à côté du champ');
    vrai(/^  capaciteEpargne: \(\) => \{/m.test(src),
      'et le panneau est défini');
  });

  test('le panneau du calcul montre les trois termes, et rien de plus', () => {
    const src = lireSource('assets/app.js');
    const bloc = src.slice(src.indexOf('  capaciteEpargne: () => {'),
                           src.indexOf("      vue: 'budget', ancre: '', cta: trad('Voir le Budget')"));
    for (const attendu of ['Revenus fixes', '− Charges fixes', '− Dépenses moyennes']) {
      vrai(bloc.includes(attendu), `le détail doit porter « ${attendu} »`);
    }
    vrai(/total: rec\.investable/.test(bloc),
      'et son total est la capacité d’épargne, pas l’accumulation');
    vrai(/rec\.capitalRembourse > 0\.005/.test(bloc),
      'la note sur le capital remboursé ne s’affiche que s’il y en a');
  });

  test('la progression constatée reste distincte des deux autres', () => {
    /* Trois notions, trois lignes, et aucune fusion : la moyenne observee vient
       des releves, l'accumulation du budget, la capacite d'epargne du budget
       aussi mais sans la dette. Les confondre ferait passer un mouvement de
       marche pour un effort d'epargne. */
    const src = lireSource('assets/app.js');
    vrai(/trad\('Moyenne mensuelle du patrimoine'\)/.test(src),
      'la variation constatée garde son propre libellé');
    vrai(/marchés et apports compris/.test(src),
      'et dit ce qu’elle contient');
  });

  test('aucun libellé n’appelle « épargne » un montant qui rembourse une dette', () => {
    /* Le motif est serre : on cherche les libelles qui affichent
       `rec.theoretical` ou `budgetee.theoretical` et le mot « épargne » dans le
       meme fragment. Un controle plus large crierait sur « épargne de
       précaution », qui est une autre notion et un nom juste. */
    const src = lireSource('assets/app.js');
    const fautes = [];
    for (const m of src.matchAll(/<dt>([\s\S]{0,400}?)<\/dt><dd>([\s\S]{0,120}?)<\/dd>/g)) {
      const [, libelle, valeur] = m;
      if (!/\.theoretical\b/.test(valeur)) continue;
      const nom = (libelle.match(/trad\('([^']+)'\)/) || [])[1] || '';
      if (/pargne/.test(nom) && !/[Aa]ccumulation/.test(nom)) fautes.push(nom);
    }
    eq(fautes.join(' | '), '',
      'un montant qui contient du capital remboursé ne s’appelle pas « épargne »');
  });
});

suite('Épargne investissable et versement suggéré', () => {

  /* Un credit dont l'amortissement est calculable : capital, taux, mensualite.
     Sans les trois, l'application ne separe pas capital et interets et ne
     devine pas — c'est la regle de `capitalRembourseParMois()`. */
  const avecCredit = (montant = 100000, taux = 2, mens = 1000) => Fixture.poser(s => {
    s.budget.income = [{ label: 'Salaire', amount: 3600 }];
    s.budget.fixedCharges = [{ id: 'c1', label: 'Loyer', amount: 1150, periode: 'mois' }];
    s.budget.expenses = [{ month: '2026-01', v: { Courses: 1000 }, note: '' }];
    s.etabs.find(e => e.id === 'e_bien').dettes = [
      { id: 'd_pret', libelle: 'Prêt', montant, taux, mensualite: mens, note: '' }];
  });

  test('le capital remboursé n’est jamais proposé comme versement à investir', () => {
    /* Le defaut central, mesure sur la demonstration : 645 EUR par mois de
       capital rembourse venaient gonfler le versement suggere, donc
       capitalisaient a 6 % l'an sur les marches. Cet argent est deja parti avec
       la mensualite ; il n'arrive sur aucun compte. */
    avecCredit();
    const rec = savingsReconciliation();
    vrai(rec.capitalRembourse > 800,
      `le crédit doit rembourser du capital chaque mois (${Math.round(rec.capitalRembourse)} €)`);
    pres(rec.investable, rec.income - rec.fixed - rec.spend,
      'l’épargne investissable est le cash qui reste, et rien d’autre');
    pres(rec.theoretical, rec.investable + rec.capitalRembourse,
      'l’accumulation patrimoniale y ajoute le capital remboursé');
    eq(suggestedMonthly(), Math.round(rec.investable),
      'et c’est l’épargne investissable que Projection reprend');
    vrai(suggestedMonthly() < Math.round(rec.theoretical),
      'strictement moins que l’accumulation : c’est tout l’objet de la correction');
  });

  test('sans crédit amortissable, les deux grandeurs se confondent', () => {
    Fixture.poser(s => {
      s.budget.income = [{ label: 'Salaire', amount: 3000 }];
      s.etabs.find(e => e.id === 'e_bien').dettes = [
        /* Sans taux : l'application ne sait pas separer capital et interets. */
        { id: 'd', libelle: 'Prêt', montant: 100000, note: '' }];
    });
    const rec = savingsReconciliation();
    eq(rec.capitalRembourse, 0, 'une dette sans taux ne rembourse rien de calculable');
    pres(rec.theoretical, rec.investable, 'les deux grandeurs se rejoignent alors');
  });

  test('le versement suggéré nourrit la poche du marché, capital exclu', () => {
    /* Le test de non-regression : on suit l'argent jusqu'au moteur. Ce qui entre
       dans la poche du marche chaque mois doit etre l'epargne investissable,
       jamais l'accumulation. */
    avecCredit();
    Fixture.poser(s => {
      delete s.meta.projMonthly;                 // versement automatique
      s.meta.projScenario = 'central';
      s.meta.projVersementVers = 'marche';
      s.etabs.find(e => e.id === 'e_bien').dettes = [
        { id: 'd_pret', libelle: 'Prêt', montant: 100000, taux: 2, mensualite: 1000, note: '' }];
      s.budget.income = [{ label: 'Salaire', amount: 3600 }];
      s.budget.fixedCharges = [{ id: 'c1', label: 'Loyer', amount: 1150, periode: 'mois' }];
      s.budget.expenses = [{ month: '2026-01', v: { Courses: 1000 }, note: '' }];
    });
    const s = projectionSettings();
    const rec = savingsReconciliation();
    eq(s.monthly, Math.round(rec.investable),
      'le versement de la projection est l’épargne investissable');
    vrai(s.monthly < Math.round(rec.theoretical),
      'et non l’accumulation, capital remboursé compris');
  });

  test('le capital remboursé entre quand même dans le patrimoine, par la dette', () => {
    /* Il n'est pas perdu : il ne capitalise pas, mais il fait monter le
       patrimoine net puisque la dette baisse. La projection le porte donc, sur
       la part plate, et jamais comme un gain. */
    /* Un seul `Fixture.poser` : il repart du fixture vierge a chaque appel, donc
       un second effacerait la dette pose par le premier. */
    Fixture.poser(s => {
      s.budget.income = [{ label: 'Salaire', amount: 3600 }];
      s.etabs.find(e => e.id === 'e_bien').dettes = [
        { id: 'd_pret', libelle: 'Prêt', montant: 100000, taux: 2, mensualite: 1000, note: '' }];
      s.meta.projScenario = 'central';
      delete s.meta.projMonthly;
    });
    const p = capitalisation({ years: 5 });
    const cinq = p.points[5];
    vrai(cinq.capitalRendu > 40000,
      `cinq ans de mensualités remboursent du capital (${Math.round(cinq.capitalRendu)} €)`);
    pres(cinq.plat, p.plat + cinq.capitalRendu,
      'la part plate monte exactement du capital remboursé');
    pres(cinq.total, cinq.contributed + cinq.gains,
      'et le total égale toujours versé plus gains');
  });
});

suite('Zéro euro par mois est une réponse', () => {

  test('choisir 0 €/mois donne vraiment une courbe plate', () => {
    /* `num(m.projMonthly) || suggestedMonthly()` traitait zero comme une
       absence : le menu offrait « 0 {dev} / mois », et le choisir affichait la
       suggestion du budget a la place. Un reglage qui refuse la valeur qu'il
       propose. */
    Fixture.poser(s => {
      s.meta.projScenario = 'central';
      s.meta.projMonthly = 0;
      s.meta.projMonthlyZeroLu = true;      // la migration a deja passe
    });
    eq(projectionSettings().monthly, 0, 'zéro veut dire zéro');
    eq(projectionSettings().monthlyAuto, false, 'et c’est un choix, pas un défaut');
    const p = capitalisation({ years: 10 });
    pres(p.points[10].contributed, p.points[0].contributed,
      'aucun euro versé en dix ans : seuls les gains bougent');
  });

  test('la clef absente demande la suggestion du budget', () => {
    Fixture.poser(s => { delete s.meta.projMonthly; s.meta.projScenario = 'central'; });
    const s = projectionSettings();
    eq(s.monthlyAuto, true, 'aucune valeur réglée : le budget décide');
    eq(s.monthly, suggestedMonthly(), 'et c’est exactement la suggestion');
  });

  test('un montant réglé est respecté', () => {
    Fixture.poser(s => { s.meta.projMonthly = 500; s.meta.projScenario = 'central'; });
    eq(projectionSettings().monthly, 500, 'cinq cents euros, ni plus ni moins');
    eq(projectionSettings().monthlyAuto, false, 'et le bouton du budget reste offert');
  });

  test('la migration retire l’ancien zéro, une fois et une seule', () => {
    /* Le zero de la graine voulait dire « automatique ». Le garder aurait aplati
       la courbe de tous les etats existants sans que personne l'ait demande.
       La migration l'efface — mais une seule fois, sinon un zero choisi
       volontairement serait effacé au chargement suivant. */
    Fixture.poser(s => { s.meta.projMonthly = 0; delete s.meta.projMonthlyZeroLu; });
    Store.migrate();
    eq(Store.state.meta.projMonthly, undefined,
      'l’ancien sentinelle disparaît : la clef absente veut dire automatique');
    eq(Store.state.meta.projMonthlyZeroLu, true, 'et le passage est noté');

    Store.state.meta.projMonthly = 0;          // un choix, cette fois
    Store.migrate();
    eq(Store.state.meta.projMonthly, 0, 'un zéro choisi après la migration survit');
    Store.migrate();
    eq(Store.state.meta.projMonthly, 0, 'et deux passes donnent le même état');
  });

  test('la graine ne pose plus de zéro', () => {
    const src = lireSource('assets/seed.js');
    vrai(!/projMonthly: 0/.test(src),
      'le sentinelle a quitté la graine : un état neuf n’a pas la clef du tout');
  });
});

suite('Le moteur de projection, chiffre par chiffre', () => {

  /* Une configuration explicite : le noyau ne lit aucun etat, donc un test peut
     poser exactement les quatre poches, les quatre taux et la dette qu'il veut.
     C'est la seule facon de verifier une formule sans qu'un fixture s'en mele. */
  const cfg = (o = {}) => Object.assign({
    marche: 0, autres: 0, garanti: 0, liquidites: 0, plat: 0,
    rate: 0, rateAutres: 0, rateGaranti: 0,
    monthly: 0, inflation: 0, target: 0, mois: 120, dettes: [],
    fractions: { marche: 1, autres: 0, garanti: 0, liquidites: 0 },
  }, o);
  const final = o => moteurProjection(cfg(o)).final;

  // --- la conversion du taux ------------------------------------------
  test('un taux annuel devient un taux mensuel, et douze mois le redonnent', () => {
    /* La convention du projet : le taux affiche est un taux ANNUEL EFFECTIF, et
       le taux mensuel en est la racine douzieme. Douze mois composes redonnent
       donc exactement le taux annuel. Un taux nominal divise par douze aurait
       donne 6,17 % l'an pour 6 % affiches. */
    const un = final({ marche: 1000, rate: 6, mois: 12 });
    pres(un.total, 1060, 'mille euros a 6 % font mille soixante au bout d’un an');
    const dix = final({ marche: 1000, rate: 6, mois: 120 });
    pres(dix.total, 1000 * Math.pow(1.06, 10),
      'et la composition sur dix ans suit exactement (1,06)^10');
  });

  test('sans versement et sans rendement, rien ne bouge', () => {
    const r = final({ marche: 50000, autres: 10000, garanti: 20000,
                      liquidites: 15000, plat: 60000, mois: 240 });
    pres(r.total, 155000, 'vingt ans a zero pour cent laissent le total intact');
    pres(r.gains, 0, 'et aucun gain n’apparaît');
  });

  // --- la convention du versement -------------------------------------
  test('le versement arrive en FIN de mois, il ne produit rien ce mois-là', () => {
    /* La convention se lit dans un seul mois : un versement de fin de mois ne
       touche pas d'interet le mois ou il tombe. Debut de mois donnerait
       (P + M)(1 + rm), soit 5,89 EUR de plus ici. La difference est petite sur
       un mois et vaut des milliers d'euros sur vingt ans. */
    const rm = Math.pow(1.06, 1 / 12) - 1;
    const r = final({ marche: 10000, rate: 6, monthly: 1000, mois: 1 });
    pres(r.total, 10000 * (1 + rm) + 1000,
      'un mois : le capital capitalise, puis le versement s’ajoute');
    vrai(Math.abs(r.total - (10000 + 1000) * (1 + rm)) > 4,
      'et ce n’est pas la convention de début de mois');
  });

  test('sans rendement, le versement s’accumule à l’euro près', () => {
    const r = final({ monthly: 500, rate: 0, mois: 120 });
    pres(r.total, 500 * 120, 'cinq cents euros pendant cent vingt mois font soixante mille');
    pres(r.gains, 0, 'et pas un centime de gain');
  });

  test('la valeur future d’une annuité ordinaire, terme à terme', () => {
    /* Le moteur boucle ; la formule fermee sert de temoin. Elles doivent se
       rejoindre au centime, sinon l'une des deux se trompe :
       P(1+r)^n + M·((1+r)^n − 1)/r, avec r mensuel et n en mois. */
    const rm = Math.pow(1.06, 1 / 12) - 1, n = 240;
    const attendu = 20000 * Math.pow(1 + rm, n)
                  + 1000 * ((Math.pow(1 + rm, n) - 1) / rm);
    const r = final({ marche: 20000, rate: 6, monthly: 1000, mois: n });
    pres(r.total, attendu, 'le moteur et la formule fermée disent le même nombre');
  });

  // --- les classes d'actifs -------------------------------------------
  test('chaque poche capitalise à son propre taux, et le total les somme', () => {
    const r = final({ marche: 20000, autres: 10000, garanti: 20000, liquidites: 15000,
                      rate: 6, rateAutres: 0, rateGaranti: 2.5, mois: 120 });
    const attendu = 20000 * Math.pow(1.06, 10) + 10000
                  + 20000 * Math.pow(1.025, 10) + 15000;
    pres(r.total, attendu,
      'les 65 000 € ne progressent pas tous à 6 % : chacun suit sa poche');
    pres(r.gainsAutres, 0, 'les autres actifs à 0 % ne produisent rien');
    pres(r.gainsLiquidites, 0, 'les liquidités non plus');
    vrai(r.gainsGaranti > 0 && r.gainsGaranti < r.gainsMarche,
      'le garanti rapporte, moins que le marché');
    pres(r.total, r.contributed + r.gains, 'et le total égale versé plus gains');
  });

  test('dix mille euros d’autres actifs à 0 % valent dix mille euros dans dix ans', () => {
    /* Zero ne veut pas dire ca ne rapporte rien mais l'application ne suppose
       aucune revalorisation. La valeur doit donc rester exactement constante, et
       non deriver d'un arrondi a chaque mois : 10 000 EUR restent 10 000 EUR
       nominalement, plusieurs annees plus tard. */
    const r = final({ autres: 10000, rate: 8, mois: 120,
                      fractions: { marche: 0, autres: 1, garanti: 0, liquidites: 0 } });
    pres(r.total, 10000, 'inchangé, quel que soit le taux du marché à côté');
    pres(final({ autres: 10000, rate: 8, mois: 360 }).total, 10000,
      'et trente ans plus tard aussi');
  });

  test('un versement sur les liquidités ne rapporte rien, et reste compté', () => {
    const r = final({ liquidites: 5000, monthly: 300, rate: 8, mois: 120,
                      fractions: { marche: 0, autres: 0, garanti: 0, liquidites: 1 } });
    pres(r.total, 5000 + 300 * 120, 'un livret non déclaré rémunéré ne rapporte rien');
    pres(r.gains, 0, 'et le versement n’est pas un gain');
  });

  // --- l'inflation ----------------------------------------------------
  test('l’inflation se retire une fois, sur le total, au nombre exact de mois', () => {
    const r = final({ marche: 100000, rate: 0, inflation: 2, mois: 120 });
    pres(r.total, 100000, 'le nominal ne bouge pas sans rendement');
    pres(r.real, 100000 / Math.pow(1.02, 10),
      'et le réel vaut le nominal déflaté de dix ans d’inflation');
    vrai(r.real < r.total, 'une inflation positive rend le réel plus petit');
  });

  test('sans inflation, réel et nominal se confondent', () => {
    const r = final({ marche: 100000, rate: 6, inflation: 0, mois: 120 });
    pres(r.real, r.total, 'zéro pour cent d’inflation ne déflate rien');
  });

  // --- la dette qui s'amortit -----------------------------------------
  test('le capital remboursé augmente le patrimoine, sans jamais capitaliser', () => {
    /* Un credit de 100 000 EUR a 2 % sur une mensualite de 1 000 EUR. Chaque
       mois, la part de capital augmente le patrimoine net : le bien ne bouge
       pas, la dette baisse. Cet argent n'arrive sur aucun compte, donc il ne
       capitalise a aucun taux — et il compte comme verse, jamais comme un gain. */
    const dette = { reste: 100000, taux: 0.02 / 12, mens: 1000 };
    const r = moteurProjection(cfg({ plat: 50000, rate: 6, mois: 12,
                                     dettes: [dette] })).final;
    vrai(r.capitalRendu > 9000 && r.capitalRendu < 11000,
      `douze mensualités de 1 000 € remboursent près de 10 000 € de capital (${Math.round(r.capitalRendu)})`);
    pres(r.total, 50000 + r.capitalRendu,
      'le patrimoine plat monte exactement du capital remboursé');
    pres(r.gains, 0, 'et pas d’un centime de gain : rien n’a été placé');
    pres(r.total, r.contributed + r.gains, 'le total reste la somme de ses parts');
  });

  test('une dette qui s’éteint arrête de rembourser', () => {
    const dette = { reste: 5000, taux: 0.02 / 12, mens: 1000 };
    const r = moteurProjection(cfg({ plat: 0, mois: 120, dettes: [dette] })).final;
    pres(r.capitalRendu, 5000,
      'le capital remboursé s’arrête au capital dû, il ne le dépasse jamais');
  });

  test('à rendement nul, plus de versement ne peut pas faire moins', () => {
    /* Un invariant simple et qui a deja ete faux ailleurs : la monotonie. */
    let precedent = -Infinity;
    for (const m of [0, 100, 500, 1000, 5000]) {
      const total = final({ marche: 30000, rate: 6, monthly: m, mois: 240 }).total;
      vrai(total >= precedent, `verser ${m} € ne peut pas donner moins que le palier précédent`);
      precedent = total;
    }
  });

  test('monter le taux d’une poche pleine ne peut pas la faire baisser', () => {
    let precedent = -Infinity;
    for (const taux of [0, 2, 4, 6, 8, 12]) {
      const total = final({ marche: 30000, rate: taux, monthly: 200, mois: 240 }).total;
      vrai(total >= precedent, `un rendement de ${taux} % ne peut pas donner moins`);
      precedent = total;
    }
  });

  test('le total égale la somme de ses parts à chaque point, dans tous les cas', () => {
    const cas = [
      { marche: 20000, autres: 10000, garanti: 20000, liquidites: 15000, plat: 60000,
        rate: 6, rateGaranti: 2.5, monthly: 500, mois: 240 },
      { marche: 1000, monthly: 0, rate: 8, mois: 120 },
      { liquidites: 1000, monthly: 700, mois: 120,
        fractions: { marche: 0, autres: 0, garanti: 0, liquidites: 1 } },
      { plat: 20000, mois: 120, dettes: [{ reste: 80000, taux: 0.03 / 12, mens: 900 }] },
    ];
    for (const [i, o] of cas.entries()) {
      for (const pt of moteurProjection(cfg(o)).points) {
        pres(pt.total, pt.contributed + pt.gains,
          `cas ${i}, année ${pt.year} : le total doit égaler versé plus gains`);
      }
    }
  });
});

suite('La cible se compare au patrimoine, et se date au mois', () => {

  const cfg = (o = {}) => Object.assign({
    marche: 0, autres: 0, garanti: 0, liquidites: 0, plat: 0,
    rate: 0, rateAutres: 0, rateGaranti: 0,
    monthly: 0, inflation: 0, target: 0, mois: 240, dettes: [],
    fractions: { marche: 1, autres: 0, garanti: 0, liquidites: 0 },
  }, o);

  test('une cible déjà atteinte aujourd’hui se dit atteinte, pas absente', () => {
    /* Elle rendait `null`, que l'ecran lisait « non atteinte » : quelqu'un a
       600 000 EUR avec une cible a 500 000 lisait que sa cible n'etait pas
       atteinte. C'est le pire genre de faux — un chiffre juste, une phrase qui
       le contredit. */
    const r = moteurProjection(cfg({ marche: 600000, target: 500000 }));
    vrai(r.atteinte, 'la cible atteinte ne rend plus un vide');
    vrai(r.atteinte.dejaAtteinte, 'et elle se declare comme déjà franchie');
    eq(r.atteinte.monthsFromNow, 0, 'zéro mois : c’est aujourd’hui');
    eq(r.atteinte.year, new Date().getFullYear(), 'et l’année est celle du jour');
  });

  test('une cible atteinte exactement au départ compte comme atteinte', () => {
    const r = moteurProjection(cfg({ marche: 500000, target: 500000 }));
    vrai(r.atteinte && r.atteinte.dejaAtteinte, 'l’égalité suffit, elle n’exige pas un euro de plus');
  });

  test('une cible franchie dans quelques mois tombe sur le bon mois du calendrier', () => {
    /* L'ancien calcul interpolait entre deux points ANNUELS et ajoutait les mois
       a l'annee du point precedent : en aout 2026, une cible franchie six mois
       plus tard s'annoncait « 2026 (+6 mois) » au lieu de fevrier 2027. Le mois
       de depart est desormais le vrai mois courant. */
    /* Le mois attendu se calcule sur le JOUR 1, jamais par `setMonth` sur la
       date du jour. Ce raccourci deborde des que le mois vise est plus court :
       le 30 aout, `setMonth(+6)` vise le 30 fevrier, que JavaScript reporte au
       2 mars — le test reclamait alors mars quand le modele disait fevrier, a
       juste titre. Il tombait donc les 29, 30 et 31, et passait le reste du
       mois : un rouge qui depend du calendrier n'apprend rien. */
    const maintenant = new Date();
    const attendu = new Date(maintenant.getFullYear(), maintenant.getMonth() + 6, 1);
    const r = moteurProjection(cfg({ marche: 0, monthly: 1000, rate: 0, target: 6000 }));
    eq(r.atteinte.monthsFromNow, 6, 'six versements de mille euros font six mille');
    eq(r.atteinte.year, attendu.getFullYear(), 'l’année est celle du sixième mois à venir');
    eq(r.atteinte.month, attendu.getMonth() + 1, 'et le mois aussi');
  });

  test('une cible franchie dans plusieurs années donne l’année juste', () => {
    const r = moteurProjection(cfg({ marche: 0, monthly: 1000, rate: 0, target: 120000 }));
    eq(r.atteinte.monthsFromNow, 120, 'cent vingt versements');
    /* Meme regle que ci-dessus : jour 1, pour que le mois vise ne deborde pas. */
    const maintenant = new Date();
    const attendu = new Date(maintenant.getFullYear(), maintenant.getMonth() + 120, 1);
    eq(r.atteinte.year, attendu.getFullYear(), 'soit dix ans plus tard, au mois près');
    pres(r.atteinte.yearsFromNow, 10, 'et dix ans de durée');
  });

  test('une cible hors de portée sur l’horizon ne s’invente pas', () => {
    const r = moteurProjection(cfg({ marche: 1000, monthly: 10, rate: 0, mois: 120,
                                     target: 1000000 }));
    eq(r.atteinte, null, 'aucune date : la cible n’est pas atteinte dans l’horizon');
  });

  test('sans cible, il n’y a rien à annoncer', () => {
    const r = moteurProjection(cfg({ marche: 100000, target: 0 }));
    eq(r.atteinte, null, 'aucune cible posée, aucune date');
  });

  test('la cible se mesure sur le nominal, patrimoine plat compris', () => {
    /* La convention de l'application : une cible de 500 000 EUR est une cible en
       euros COURANTS, comparee au total nominal — et sur le patrimoine entier,
       immobilier compris, puisque c'est ce que la courbe affiche. Un test la
       fixe, faute de quoi elle deriverait en silence. */
    const r = moteurProjection(cfg({ marche: 100000, plat: 400000, target: 500000,
                                     inflation: 5 }));
    vrai(r.atteinte && r.atteinte.dejaAtteinte,
      'cent mille de placements et quatre cents mille de bien atteignent la cible');
    const s = moteurProjection(cfg({ marche: 100000, plat: 400000, target: 500000,
                                     inflation: 5, mois: 12 })).final;
    vrai(s.real < s.total, 'le réel existe à côté, mais ce n’est pas lui qui décide');
  });
});

suite('Les leviers d’une cible passent par le moteur, pas par une formule à côté', () => {

  test('le versement recommandé atteint vraiment la cible', () => {
    /* La propriete qui compte, et la seule qui garantissait quelque chose :
       reinjecter la recommandation dans le moteur doit franchir la cible. La
       formule fermee d'avant faisait progresser TOUT le patrimoine financier au
       taux des actifs de marche — non cote et liquidites compris — donc elle
       annoncait un versement trop faible, et la phrase contredisait la courbe
       affichee juste au-dessus. */
    Fixture.poser(s => {
      s.meta.projScenario = 'central';
      s.meta.projMonthly = 200;
      s.meta.projTarget = 400000;
      s.meta.projVersementVers = 'marche';
    });
    const req = targetRequirements({ target: 400000, years: 20 });
    vrai(req.monthly > 0, `un versement doit être proposé (${req.monthly})`);
    const avec = capitalisation({ years: 20, monthly: req.monthly });
    vrai(avec.points[20].total >= 400000 - 1,
      `avec ${Math.round(req.monthly)} € par mois, la cible doit être atteinte `
      + `(${Math.round(avec.points[20].total)} contre 400 000)`);
    /* Et pas beaucoup plus : une dichotomie qui converge doit serrer la borne. */
    const sans = capitalisation({ years: 20, monthly: req.monthly - 20 });
    vrai(sans.points[20].total < 400000,
      'vingt euros de moins ne doivent plus suffire : la valeur est bien la borne');
  });

  test('le rendement recommandé atteint vraiment la cible', () => {
    Fixture.poser(s => {
      s.meta.projScenario = 'central';
      s.meta.projMonthly = 300;
      s.meta.projTarget = 400000;
    });
    const req = targetRequirements({ target: 400000, years: 20 });
    if (req.rate == null) { vrai(true, 'aucun rendement réaliste ne suffit, et c’est dit'); return; }
    const avec = capitalisation({ years: 20, rate: req.rate });
    vrai(avec.points[20].total >= 400000 - 1,
      `à ${req.rate.toFixed(2)} % l’an la cible doit être atteinte `
      + `(${Math.round(avec.points[20].total)})`);
  });

  test('le nombre d’années annoncé est celui où le moteur franchit la cible', () => {
    Fixture.poser(s => {
      s.meta.projScenario = 'central';
      s.meta.projMonthly = 500;
      s.meta.projTarget = 400000;
    });
    const req = targetRequirements({ target: 400000, years: 20 });
    vrai(req.years > 0, 'une durée doit être proposée');
    const long = capitalisation({ years: Math.ceil(req.years) + 1 });
    vrai(Math.abs(long.targetReached.yearsFromNow - req.years) < 0.1,
      `la durée du levier (${req.years.toFixed(2)}) et celle de la courbe `
      + `(${long.targetReached.yearsFromNow.toFixed(2)}) sont le même nombre`);
  });

  test('une cible déjà atteinte ne demande aucun levier', () => {
    Fixture.poser(s => { s.meta.projTarget = 1000; s.meta.projScenario = 'central'; });
    const req = targetRequirements({ target: 1000, years: 20 });
    vrai(req.reachable, 'la cible est déjà franchie');
    eq(req.monthly, null, 'et aucun versement n’est réclamé');
    eq(req.years, null, 'ni aucune attente');
  });

  test('les poches à 0 % ne se font pas passer pour des actifs de marché', () => {
    /* Le defaut d'origine, mesure : 10 000 EUR de marche et 55 000 EUR a zero
       pour cent. L'ancienne formule capitalisait les 65 000 a 6 %, donc elle
       reclamait un versement nettement plus faible que celui qu'il faut. Le
       moteur, lui, ne prete le taux du marche qu'a la poche du marche. */
    const cfg = {
      marche: 10000, autres: 25000, garanti: 0, liquidites: 30000, plat: 0,
      rate: 6, rateAutres: 0, rateGaranti: 0, monthly: 0, inflation: 0,
      target: 0, mois: 240, dettes: [],
      fractions: { marche: 1, autres: 0, garanti: 0, liquidites: 0 },
    };
    const vraiTotal = moteurProjection(cfg).final.total;
    const commeSiTout = 65000 * Math.pow(1.06, 20);
    vrai(vraiTotal < commeSiTout * 0.75,
      `le vrai total (${Math.round(vraiTotal)}) est loin de celui d’un patrimoine `
      + `entièrement au taux du marché (${Math.round(commeSiTout)})`);
  });
});

suite('Un scénario nommé plutôt qu’un rendement à deviner', () => {

  /* Cinq champs demandaient un rendement par poche : actifs de marche, non
     cote, capital garanti, liquidites, inflation. Personne ne connait le
     rendement futur de la bourse — pas meme un investisseur experimente — donc
     la question demande a l'utilisateur de deviner a notre place, et il lit
     ensuite sa propre reponse comme une prevision.

     Un scenario nomme deplace la question de « combien ? » a « plutot prudent
     ou plutot optimiste ? ». Les taux restent poseables a la main, replies. */

  test('les trois scénarios montent, et les autres actifs restent à zéro', () => {
    const marche = SCENARIOS_PROJECTION.map(([, , r]) => r.marche);
    eq(marche.join(' < '), '4 < 6 < 8',
      'prudent, central, dynamique : des hypothèses ordonnées');
    for (const [cle, , r] of SCENARIOS_PROJECTION) {
      eq(r.autres, 0,
        `« ${cle} » ne doit supposer aucune hausse des autres actifs : personne ne `
        + 'connaît le rendement futur d’un bitcoin ni la date du prochain tour de table');
      eq(r.liquidites, 0, `« ${cle} » : un livret non déclaré rémunéré ne rapporte rien`);
      vrai(r.garanti > 0 && r.garanti < r.marche,
        `« ${cle} » : le capital garanti rapporte, moins que le marché`);
    }
    eq(SCENARIO_DEFAUT, 'central', 'le scénario central s’applique par défaut');
  });

  test('un état neuf part sur central, un état déjà réglé ne bouge pas', () => {
    /* La regle qui compte : appliquer « central » a quelqu'un qui avait pose 8 %
       changerait sa courbe sans qu'il ait rien demande. Une projection ne fait
       jamais ca. */
    Fixture.poser(s => { delete s.meta.projScenario; delete s.meta.projRate; });
    eq(sourceDesTaux(), 'central', 'sans rien de réglé, les taux viennent de « central »');
    pres(projectionSettings().rate, 6, 'et son taux de marché');

    Fixture.poser(s => { delete s.meta.projScenario; s.meta.projRate = 8; });
    eq(sourceDesTaux(), 'perso',
      'un taux déjà saisi passe en personnalisé, il ne se fait pas écraser');
    pres(projectionSettings().rate, 8, 'et sa valeur survit intacte');
  });

  test('le scénario gouverne les trois taux, le personnalisé les rend', () => {
    Fixture.poser(s => {
      s.meta.projScenario = 'prudent';
      s.meta.projRate = 19; s.meta.projRateGaranti = 7; s.meta.projRateAutres = 5;
    });
    const p = projectionSettings();
    pres(p.rate, 4, 'le scénario prudent impose son taux de marché');
    pres(p.rateGaranti, 2, 'et celui du garanti');
    pres(p.rateAutres, 0, 'et celui du non coté');

    Fixture.poser(s => {
      s.meta.projScenario = 'perso';
      s.meta.projRate = 19; s.meta.projRateGaranti = 7; s.meta.projRateAutres = 5;
    });
    const q = projectionSettings();
    pres(q.rate, 19, 'en personnalisé, les champs reprennent la main');
    pres(q.rateGaranti, 7, 'les trois');
    pres(q.rateAutres, 5, 'sans exception');
  });

  test('chaque destination reçoit tout le versement, et les parts font un', () => {
    /* Une poche recoit, les autres rien. La regle qui compte est que la somme
       des fractions fasse exactement un : en dessous, un euro verse se perd ;
       au-dessus, la projection en invente.

       La somme se fait sur les clefs RENDUES, non sur une liste ecrite ici : la
       crypto est devenue une destination, et un compte fige aurait laisse passer
       une poche qui recoit sans entrer dans le total. */
    for (const [poche] of VERSEMENT_VERS) {
      Fixture.poser(s => { s.meta.projVersementVers = poche; });
      const f = repartitionVersement();
      eq(Object.keys(f).length, VERSEMENT_VERS.length,
        'une fraction par destination, ni plus ni moins');
      pres(Object.values(f).reduce((s, x) => s + x, 0), 1,
        `« ${poche} » : les parts doivent faire exactement un`);
      pres(f[poche], 1, `« ${poche} » doit recevoir tout le versement`);
    }
  });

  test('une destination inconnue retombe sur le marché', () => {
    /* Un etat ecrit par une version anterieure peut porter n'importe quoi ici —
       « cible » l'a ete un temps. Le repli est muet et sans perte : mieux vaut
       une hypothese lisible qu'un versement qui s'evapore. */
    Fixture.poser(s => { s.meta.projVersementVers = 'cible'; });
    pres(repartitionVersement().marche, 1,
      'une valeur qui ne nomme aucune poche verse sur les actifs de marché');
    pres(repartitionVersement().garanti, 0, 'et nulle part ailleurs');
  });

  test('le total égale toujours ce qui a été versé plus les gains', () => {
    /* La regle cardinale du projet, appliquee au moteur : elle etait tenue quand
       le versement tombait dans une seule poche, et le partage pouvait la casser
       — la part envoyee au garanti aurait compte comme un gain. */
    for (const vers of ['marche', 'garanti', 'nonCote', 'liquidites']) {
      Fixture.poser(s => {
        s.meta.projMonthly = 500; s.meta.projScenario = 'central';
        s.meta.projVersementVers = vers;
      });
      const c = capitalisation({ years: 10 });
      for (const pt of c.points) {
        pres(pt.total, pt.contributed + pt.gains,
          `« ${vers} », année ${pt.year} : le total doit égaler versé plus gains`);
      }
    }
  });

  test('le capital garanti reçoit sa part, et elle n’est pas un gain', () => {
    /* Il ne recevait rien : les trois destinations offertes l'ignoraient, et un
       versement dirige vers lui disparaissait du capital tout en restant compte
       comme verse. */
    Fixture.poser(s => {
      s.meta.projMonthly = 1000; s.meta.projScenario = 'central';
      s.meta.projVersementVers = 'garanti';
    });
    const c = capitalisation({ years: 1 });
    const un = c.points[1];
    vrai(un.contributed > c.points[0].contributed + 11000,
      'douze mille euros versés doivent se retrouver dans le versé');
    pres(un.total, un.contributed + un.gains, 'et le total reste la somme de ses parts');
  });

  test('les montants sont nominaux, et le réel en découle', () => {
    /* Le moteur capitalise en euros courants ; `real` retire l'inflation une
       fois, sur le total. Les deux coexistent, et la page dit lequel elle
       montre — c'est ce qui permet d'ecrire « en euros d'aujourd'hui » sans
       mentir. */
    Fixture.poser(s => {
      s.meta.projMonthly = 0; s.meta.projScenario = 'central'; s.meta.projInflation = 2;
    });
    const c = capitalisation({ years: 10 });
    const dix = c.points[10];
    pres(dix.real, dix.total / Math.pow(1.02, 10),
      'le réel est le nominal déflaté de l’inflation, sur dix ans');
    vrai(dix.real < dix.total, 'et il est plus petit : c’est le pouvoir d’achat');
  });

  test('plus le scénario est dynamique, plus la projection monte', () => {
    const total = scen => {
      Fixture.poser(s => { s.meta.projMonthly = 300; s.meta.projScenario = scen; });
      return capitalisation({ years: 20 }).points[20].total;
    };
    const p = total('prudent'), c = total('central'), d = total('dynamique');
    vrai(p < c && c < d,
      `les trois scénarios doivent s’ordonner : ${Math.round(p)} < ${Math.round(c)} < ${Math.round(d)}`);
  });

  test('le choix d’hypothèses ne se déguise pas en barre d’onglets', () => {
    /* Deux raisons, et la seconde a ete vue a l'ecran.

       Le dessin : trois pilules `.segmented` reprenaient exactement l'allure des
       sous-onglets qui coiffent la meme page. Deux controles identiques a
       l'oeil, l'un qui change d'ecran et l'autre un calcul.

       La geometrie : `.sous-onglets` est collante et vit a z-index 6, ce qu'il
       faut pour une navigation en tete de page et ce qui est ruineux dans une
       carte. Mesure a 375 px : la barre recouvrait le menu « Affectation des
       versements » et l'intitule suivant. */
    const src = lireSource('assets/app.js');
    vrai(/\$\{choixHypothese\(s\.scenario\)\}/.test(src),
      'le scénario a son propre contrôle');
    vrai(!/segments\(SCENARIOS_PROJECTION/.test(src),
      'et il n’emprunte plus le balisage des sous-onglets');
    /* Les paves descendent de la table : trois libelles ecrits a la main a cote
       d'elle finiraient par ne plus la decrire. Et le taux imprime est celui de
       la table, non un reglage relu — sinon un scenario non retenu afficherait
       le taux du scenario en cours. */
    vrai(/SCENARIOS_PROJECTION\.map\(\(\[cle, nom, taux\]\)/.test(src),
      'les trois pavés descendent de la table des scénarios');
    vrai(/fmtPct\(taux\.marche, 0\)/.test(src),
      'chaque pavé imprime le taux de son propre scénario');
    const css = lireSource('assets/styles.css');
    /* Quatre colonnes egales depuis que « Personnalise » a sa case, et deux par
       deux sous 768 px : quatre dans les 311 px d'une carte a 375 px feraient
       70 px, moins que le mot qu'elles portent. La cible du doigt ne depend
       jamais de la longueur du libelle. */
    vrai(/\.choix-hypothese \{[\s\S]{0,200}grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/
      .test(css), 'quatre colonnes égales sur grand écran');
    const petit = css.slice(css.indexOf('@media (max-width: 767px)'));
    vrai(/\.choix-hypothese \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/
      .test(petit), 'et deux par deux sous 768 px');
    vrai(/\.choix-hypothese button\.on \{[\s\S]{0,200}border-color: var\(--accent\)/.test(css),
      'le choix retenu se voit au bord accentué, pas seulement à sa teinte de fond');
  });

  test('la cible répond là où on la lit, pas deux cartes plus bas', () => {
    /* Poser une cible pose une question : « quand ? ». La reponse se lit la ou
       l'on lit le total, sous lui et ses parts, dans la carte de tete ; la
       carte des hypotheses ne garde que les leviers. */
    /* La fenetre va de la tete de la carte de tete a la fin de la phrase du
       verdict : pas une longueur en caracteres, qui bougerait au prochain
       commentaire ajoute. */
    const brut = lireSource('assets/app.js');
    const debut = brut.indexOf('class="proj-tete"');
    /* La fenetre s'arrete a la fin du paragraphe, jamais a un nombre de
       caracteres : une phrase qui s'allonge le pousse dehors, et le test
       devient rouge sans qu'aucun comportement n'ait change. */
    const iCible = brut.indexOf('ligne-cible">', debut);
    const src = brut.slice(debut, brut.indexOf('</p>', iCible) + 4);
    vrai(debut > 0, 'la tête de la carte doit exister');
    /* Sous le total et ses parts, hors de toute grille : dans une cellule de
       valeur, « franchie en 2050 (dans 25 ans) » repousserait l'intitule voisin
       sur deux lignes. */
    vrai(iCible > brut.indexOf('${parts.map((x, i) =>', debut),
      'le verdict vit sous le total et ses parts, pas dans une grille');
    /* LE MOIS, PAS SEULEMENT L'ANNEE. Entre janvier et decembre 2029 il y a un
       an de vie, et le moteur boucle au mois : il sait lequel c'est. */
    vrai(/moisEtAnnee\(anneeAtteinte\.year, anneeAtteinte\.month\)/.test(src),
      'la date d’atteinte se lit au mois dans la carte de tête');
    vrai(/trad\('vers'\)/.test(src),
      'et au conditionnel : c’est une simulation, pas une promesse');
    vrai(/fmtDelaiMois\(anneeAtteinte\.monthsFromNow\)/.test(src),
      'le délai aussi se compte au mois');
    vrai(/trad\('non atteinte sur l’horizon simulé'\)/.test(src),
      'et le verdict inverse s’y lit aussi : une cible manquée est une réponse, pas un silence');

    /* Le verdict ne se dit qu'une fois : deux copies, et c'est celle qu'on
       oublie de changer qui contredit l'autre. */
    const tout = lireSource('assets/app.js');
    eq((tout.match(/trad\('non atteinte sur l’horizon simulé'\)/g) || []).length, 1,
      'le verdict ne doit exister qu’à un seul endroit');
    vrai(/s\.target && !anneeAtteinte \? `<div class="note"/.test(tout),
      'la note des leviers ne s’affiche que si la cible n’est pas atteinte');
  });

  test('plus aucun jargon dans les valeurs affichées', () => {
    /* « aucun, porté à plat » demandait de savoir ce que « porter a plat »
       veut dire. « 0 % par an » se lit sans glossaire, et l'aide explique. */
    const src = lireSource('assets/app.js');
    eq((src.match(/porté à plat|portées à plat/g) || []).length, 0,
      '« porté à plat » est du jargon : afficher « 0 % par an » et expliquer dans l’aide');
    vrai(!/trad\('aucune'\)/.test(src),
      '« aucune » comme valeur de cible se lit comme une absence de réponse, pas comme un choix');
  });
});

suite('Un réglage vit avec les réglages', () => {

  /* Notifications avait son entree de menu, donc sa vue, et un commentaire du
     code le justifiait ainsi : « une entree, une adresse, un titre ». C'etait
     prendre le menu pour la cause alors qu'il en etait la consequence. Ce qu'on
     regle la est un reglage, et le menu portait deja Donnees et Preferences cote
     a cote — une troisieme ligne pour un interrupteur.

     Preferences dit donc quatre choses, dans cet ordre : apparence, langue,
     marches, puis ce que la cloche a le droit de dire. L'apparence passe devant
     la langue parce qu'on la change plus souvent, et que son effet se voit sur
     la page ou on la pose.

     « Marchés » remplace « Comportement » : ce dernier nommait un mecanisme, pas
     un sujet. La carte regle le rafraichissement des cours et la place de
     cotation par defaut — ce sont les marches. Le mot sert aussi de nom a la
     page Positions ; ici il se lit sous « Préférences », donc « les preferences
     de marche », et aucune ambiguite ne subsiste. */

  test('les quatre sections se suivent dans l’ordre annoncé', () => {
    const src = lireSource('assets/app.js');
    const vue = src.slice(src.indexOf('function viewSettings'),
                          src.indexOf('\n}', src.indexOf('function viewSettings')));
    vrai(vue, 'viewSettings doit être trouvable');
    /* Des groupes en surtitre, plus des cartes a en-tete : Général, Marchés,
       puis les notifications qui portent leurs propres groupes. */
    const titres = [...vue.matchAll(/<h3 class="surtitre">\$\{(?:t|trad)\('([^']+)'\)\}<\/h3>/g)].map(m => m[1]);
    eq(titres.join(' · '), "settings.general · settings.behaviour", 'l’ordre des deux premiers groupes');
    vrai(/\$\{viewNotifs\(\)\}/.test(vue),
      'les notifications, rappels et alertes ferment la page');
  });

  test('les notifications n’ont plus de vue ni d’entrée de menu', () => {
    const src = lireSource('assets/app.js');
    vrai(!/notifications:\s*\{\s*cle:/.test(src),
      'la vue notifications a rejoint Préférences, elle ne doit plus exister à part');
    const html = lireSource('index.html');
    vrai(!/href="#\/notifications"/.test(html),
      'le menu ne doit plus porter d’entrée Notifications');
  });

  test('l’ancienne adresse mène aux préférences', () => {
    /* Elle est dans des signets, et la cloche n'y mene plus : sans redirection,
       `#/notifications` retombe sur la vue d'ensemble sans rien dire. */
    const src = lireSource('assets/app.js');
    const m = src.match(/notifications:\s*\['(\w+)',\s*'(\w+)',\s*(\w+)\]/);
    vrai(m, 'la redirection notifications doit exister');
    eq(m[1], 'settings', 'elle mène aux préférences');
  });

  test('la cloche garde son bouton et son action', () => {
    /* Fusionner la page ne doit pas emporter le signal : la cloche de l'en-tete
       est le chemin court vers ce que l'application a a dire, et elle n'a rien a
       voir avec l'ecran de reglage. */
    const html = lireSource('index.html');
    vrai(/id="btnCloche"/.test(html), 'le bouton de la cloche reste dans l’en-tête');
    const src = lireSource('assets/app.js');
    vrai(/'notifications'\(\)\s*\{/.test(src),
      'son action reste câblée, elle ouvre le panneau et non une page');
  });
});

suite('La ligne du temps se lit sur une seule ligne', () => {

  /* « Relevés » etait un sous-onglet de Budget, entre deux saisies de depenses.
     Le mot disait le GESTE — enregistrer un releve — et non ce qu'on vient y
     chercher, qui est l'histoire du patrimoine. Renomme « Historique » et place
     entre « Aujourd'hui » et « Projection », il donne une ligne du temps qui se
     lit sans explication : ce qui est, ce qui a ete, ce qui pourrait etre.

     Ce qui devait etre mesure avant de le faire : la barre passe a trois
     onglets, et celui du milieu porte la pastille ambre quand un releve manque.
     C'est exactement le cas dont le code se mefiait pour « Charges fixes ».

     Mesure a 375 px : onglet utile 112 px, « Aujourd'hui » 69 px de texte,
     « Historique » 61, « Projection » 60. La pastille vaut 6 px plus 6 px de
     marge, donc « Historique » en demande 73 sur les 88 disponibles. Aucun
     debord, barre inchangee a 53 px. « Charges fixes », a 78 px, n'aurait pas
     tenu — c'est bien le nom qui decide, pas la position. */

  /* Le harnais ne charge pas `app.js` : les tables des vues se lisent donc dans
     la source, comme partout ailleurs dans ce fichier. Un seul lecteur, pose
     ici, plutot qu'une expression rationnelle recopiee dans chaque controle. */
  function ongletsParVue() {
    const src = lireSource('assets/app.js');
    const d = src.indexOf('const SOUS_ONGLETS');
    const bloc = src.slice(d, src.indexOf('\n};', d));
    const vues = {};
    /* Chaque clef de premier niveau ouvre sa liste ; on decoupe sur elles. */
    const bornes = [...bloc.matchAll(/^  (\w+):\s*\[/gm)];
    bornes.forEach((b, i) => {
      const fin = i + 1 < bornes.length ? bornes[i + 1].index : bloc.length;
      const part = bloc.slice(b.index, fin);
      vues[b[1]] = [...part.matchAll(/\['([\w-]+)',\s*'([^']*)'/g)]
        .map(m => ({ cle: m[1], label: m[2] }));
    });
    return vues;
  }

  function clesAPastille() {
    const src = lireSource('assets/app.js');
    const m = src.match(/const PASTILLE_SOUS_ONGLET = \{([\s\S]*?)\n\};/);
    vrai(m, 'PASTILLE_SOUS_ONGLET doit rester repérable');
    return [...m[1].matchAll(/^\s*(\w+)\s*:/gm)].map(x => x[1]);
  }

  test('la vue d’ensemble porte les trois onglets, dans l’ordre du temps', () => {
    const noms = ongletsParVue().overview.map(o => o.cle);
    eq(noms.join(' → '), 'aujourdhui → historique → projection',
      'l’ordre raconte le temps : ce qui est, ce qui a été, ce qui pourrait être');
  });

  test('un onglet qui peut porter une pastille garde un nom court', () => {
    /* Le controle ne refait pas la mesure, il garde l'invariant qu'elle etablit.
       Onze caracteres : « Historique » en fait dix, « Charges fixes » treize et
       ne tiendrait pas. Un proxy, et il est dit comme tel — sans rendu, la suite
       ne peut pas mesurer des pixels. */
    const LIMITE = 11;
    const pastilles = clesAPastille();
    const fautifs = [];
    for (const [vue, onglets] of Object.entries(ongletsParVue())) {
      if (onglets.length < 3) continue;          // a deux, la place est double
      for (const o of onglets) {
        if (!pastilles.includes(o.cle)) continue;
        if (o.label.length > LIMITE) fautifs.push(`${vue}/${o.cle} : « ${o.label} »`);
      }
    }
    eq(fautifs.length, 0,
      'onglet(s) à pastille dont le nom dépasse ' + LIMITE + ' caractères dans une '
      + 'barre à trois : ' + fautifs.join(', ') + ' — le libellé passera à la ligne '
      + 'et la barre gagnera 17 px');
  });

  test('l’ancienne adresse des relevés mène au nouvel onglet', () => {
    /* Elle est dans les favoris de quelqu'un, et elle a deja change de place une
       fois. Une redirection cassee renvoie sur la vue d'ensemble sans dire
       pourquoi l'onglet attendu n'est pas la. */
    const src = lireSource('assets/app.js');
    const m = src.match(/history:\s*\['(\w+)',\s*'(\w+)',\s*'(\w+)'\]/);
    vrai(m, 'la redirection history doit rester repérable');
    eq(m[1], 'overview', 'elle mène désormais à la vue d’ensemble');
    eq(m[3], 'historique', 'et à l’onglet historique');
    /* Et l'onglet vise existe vraiment : une redirection vers un onglet absent
       retombe silencieusement sur le premier. */
    vrai(ongletsParVue().overview.some(o => o.cle === m[3]),
      `l’onglet « ${m && m[3]} » doit exister dans la vue d’ensemble`);
  });

  test('chaque saisie en attente s’annonce là où elle se fait', () => {
    /* Les deux pastilles de menu ont ete confondues le temps ou les releves
       vivaient dans Budget. Les garder ensemble enverrait maintenant chercher au
       mauvais onglet une fois sur deux. */
    const src = lireSource('assets/app.js');
    vrai(/pastille\('#badgeOverview'/.test(src),
      'la vue d’ensemble doit porter la pastille du relevé');
    vrai(/pastille\('#tabBadgeOverview'/.test(src),
      'la barre du bas aussi, sinon le signal disparaît sur téléphone');
    const html = lireSource('index.html');
    for (const id of ['badgeOverview', 'tabBadgeOverview']) {
      vrai(html.includes(`id="${id}"`), `${id} doit exister dans le balisage`);
    }
  });
});

suite('Une valeur n’affame pas les libellés de sa grille', () => {

  /* Dans la carte Financement, sur telephone, aucun intitule ne s'imprime une
     lettre par ligne.

     La cause possible n'est pas dans le libelle mais dans la definition de la
     grille. Une piste `auto` prend son max-content AVANT que le `fr` ne recoive
     quoi que ce soit : le `fr` n'a que le reliquat. Avec `minmax(0, 1fr)`, une
     seule valeur large -- une ligne capital, interets et assurance de 301 px
     pour 300 disponibles -- reduirait la colonne des libelles a ZERO. Tous les
     intitules en patiraient : une valeur affame toute sa grille.

     Le meme defaut guette Nom officiel sur la fiche d'un titre. C'est le
     minimum a zero qu'il faut retirer, pas la valeur qu'il faudrait
     raccourcir. */
  test('la colonne des libellés porte un plancher', () => {
    const css = lireSource('assets/styles.css');
    vrai(css, 'styles.css doit se lire');
    /* `.kv` seule, pas `.kv-texte` : celle-la met deliberement le minimum a zero
       sur la colonne des VALEURS, ce qui est l'inverse et qui est juste. */
    const pistes = [...css.matchAll(/\.kv\s*\{[^}]*?grid-template-columns:\s*([^;]+);/g)]
      .map(m => m[1].trim());
    vrai(pistes.length >= 2,
      'la règle existe au moins deux fois, une fois pour le mobile');
    const fautives = pistes.filter(p => /minmax\(\s*0\s*,\s*1fr\s*\)\s+auto/.test(p));
    eq(fautives.length, 0,
      'colonne de libellés sans plancher : « ' + fautives.join(' » « ')
      + ' » — une valeur large l’écrasera à zéro et les mots se couperont '
      + 'lettre par lettre');
    for (const p of pistes) {
      vrai(/minmax\(\s*min-content\s*,\s*1fr\s*\)/.test(p),
        `« ${p} » : le plancher doit être min-content, pas un nombre écrit à la main`);
    }
  });

  test('une valeur qui est une phrase a le droit de se replier', () => {
    /* Le plancher suffit a rendre les libelles lisibles, mais une phrase forcee
       sur une ligne prendrait encore tout le reste. Les deux vont ensemble : le
       plancher protege le libelle, la permission laisse la valeur tenir dans ce
       qui reste. */
    const css = lireSource('assets/styles.css');
    vrai(/\.kv dd\.phrase\s*\{[^}]*white-space:\s*normal/.test(css),
      'une valeur marquée comme phrase doit pouvoir passer à la ligne');

    const src = lireSource('assets/app.js');
    /* Une valeur qui joint plusieurs montants par un point median est une phrase,
       pas un montant. Le controle ne regarde que celles-la : un point median
       decoratif dans une valeur courte ne pose aucun probleme. */
    const dds = [...src.matchAll(/<dd([^>]*)>((?:(?!<\/dd>)[\s\S]){0,600})<\/dd>/g)];
    const fautifs = dds
      .filter(m => (m[2].match(/fmtEUR/g) || []).length >= 2 && m[2].includes('·'))
      .filter(m => !/class="[^"]*phrase/.test(m[1]))
      .map(m => m[2].replace(/\s+/g, ' ').slice(0, 50));
    eq(fautifs.length, 0,
      'valeur(s) joignant plusieurs montants sans être marquée(s) « phrase » : '
      + fautifs.join(' | '));
  });
});

suite('Une infobulle de graphique reste dans sa carte', () => {

  /* Le defaut, signale sur une capture de telephone : en bas des listes
     d'Allocation, l'infobulle debordait de sa carte et ses deux dernieres
     lignes — le montant et la part, c'est-a-dire tout ce qu'elle a a dire —
     tombaient hors du cadre.

     La cause : `rankedBars` est la seule infobulle des graphiques dont le haut
     suit la ligne survolee. Les autres s'epinglent en tete, a 8, 6, 4 ou 2
     pixels, donc rien ne peut les faire sortir. Celle-la valait
     `index * rowH - 6`, sans borne basse. Elle est posee en absolu dans le
     conteneur du graphique : c'est la hauteur de ce conteneur qui doit la
     retenir.

     Le controle porte sur la regle et non sur cette ligne : tout haut CALCULE
     doit etre borne. Un haut constant n'en a pas besoin, et l'exiger ferait un
     test qu'on contourne. */
  test('tout haut calculé est borné par la hauteur du conteneur', () => {
    const src = lireSource('assets/charts.js');
    vrai(src, 'charts.js doit se lire');
    const poses = [...src.matchAll(/tip\.style\.top\s*=\s*([^;]+);/g)].map(m => m[1].trim());
    vrai(poses.length >= 4, 'les graphiques doivent poser le haut de leurs infobulles');

    const fautifs = poses.filter(expr => {
      /* Un haut constant : une chaine de pixels, rien de calcule. Le signe moins
         compte comme constante — une courbe epingle son infobulle six pixels
         au-dessus de son cadre, volontairement, et exiger une borne la aurait
         fait corriger le test au lieu du code. */
      if (/^'-?\d+px'$/.test(expr)) return false;
      return !/Math\.min/.test(expr);
    });
    eq(fautifs.length, 0,
      'infobulle(s) dont le haut se calcule sans borne basse : « '
      + fautifs.join(' » « ') + ' » — elle sortira de sa carte en bas de liste');
  });

  test('la borne se mesure sur le conteneur, pas sur un nombre écrit', () => {
    /* Une borne posee en dur — « pas plus bas que 300 px » — redeviendrait
       fausse a la premiere liste plus longue. Elle doit lire la hauteur que le
       graphique s'est donnee. */
    const src = lireSource('assets/charts.js');
    const bornes = [...src.matchAll(/tip\.style\.top\s*=[\s\S]{0,40}?Math\.min\(([^,]+),/g)]
      .map(m => m[1].trim());
    vrai(bornes.length >= 1, 'au moins une infobulle doit être bornée');
    for (const b of bornes) {
      vrai(/H|clientHeight|offsetHeight|r\.height/.test(b),
        `la borne « ${b} » n’est pas une hauteur mesurée`);
    }
  });
});

suite('Une classe d’actif porte un seul nom', () => {

  /* Le defaut, vu sur une capture de telephone et pas par un test : le meme
     argent s'appelait « Private assets » dans le tableau des classes et
     « Private investments » dans l'infobulle et sur l'accueil. Deux mots justes
     qui designent la meme chose, et aucun controle ne pouvait le voir — parce
     que rien ne relie deux libelles ecrits a la main.

     La cause etait la recopie : sept poches declaraient leur nom a cote de
     `CLASSES_ACTIFS` qui les nomme deja, et deux avaient derive. Les poches le
     derivent maintenant ; ce qui suit garde le rattachement, faute duquel une
     poche nouvelle porterait `undefined`. */

  test('chaque poche du graphique se rattache à une classe', () => {
    const src = lireSource('assets/app.js');
    const bloc = src.slice(src.indexOf('const POCHE_CLASSE'),
                           src.indexOf('function seriesUtiles'));
    vrai(bloc, 'la table de rattachement doit être trouvable');
    const rattachees = [...bloc.matchAll(/(\w+):\s*'(\w+)'/g)].map(m => [m[1], m[2]]);
    const poches = [...bloc.matchAll(/\{ key: '(\w+)'/g)].map(m => m[1]);
    vrai(poches.length >= 5, 'le graphique doit porter ses poches');

    const table = new Map(rattachees);
    for (const poche of poches) {
      const classe = table.get(poche);
      vrai(classe, `la poche « ${poche} » ne se rattache à aucune classe`);
      vrai(CLASSES_ACTIFS[classe] !== undefined,
        `la poche « ${poche} » pointe « ${classe} », absente de CLASSES_ACTIFS`);
    }
  });

  test('aucune poche ne réécrit le nom de sa classe', () => {
    /* Le controle porte sur la cause. Un libelle ecrit dans la liste des poches
       est une seconde source pour un nom qui en a deja une, et c'est la
       neuvieme recopie — pas les huit premieres — qui divergera. */
    const src = lireSource('assets/app.js');
    const bloc = src.slice(src.indexOf('const SERIES_PATRIMOINE'),
                           src.indexOf('function seriesUtiles'));
    eq((bloc.match(/\{ key: '\w+',\s*label:/g) || []).length, 0,
      'une poche déclare son libellé au lieu de le dériver de sa classe');
    vrai(/\.map\(s => \(\{ \.\.\.s, label: trad\(CLASSES_ACTIFS\[POCHE_CLASSE/.test(bloc),
      'les libellés doivent se dériver de CLASSES_ACTIFS');
  });

  test('chaque nom de classe passe par la traduction', () => {
    /* `bienValeur` portait une chaine nue : la classe s'affichait en francais
       dans une application anglaise. Latent tant que personne ne declare
       d'objet de valeur, ce qui est la pire forme du defaut — il attend. */
    const src = lireSource('assets/store.js');
    const bloc = src.slice(src.indexOf('const CLASSES_ACTIFS'),
                           src.indexOf('};', src.indexOf('const CLASSES_ACTIFS')));
    const nues = [...bloc.matchAll(/^\s*(\w+):\s*'([^']+)'/gm)].map(m => m[1]);
    eq(nues.length, 0,
      'classe(s) dont le nom ne passe pas par trad() : ' + nues.join(', '));
  });

  test('l’export tableur écrit dans la langue de l’application', () => {
    /* Une cellule de tableur est du texte affiche. `POCKET` etait un objet de
       chaines francaises nues, donc l'export anglais sortait « Quotidien ». */
    const src = lireSource('assets/app.js');
    /* Borne par le contenu, jamais par un compte de caracteres : une fenetre
       de 400 signes atteignait le code suivant et y trouvait une chaine sans
       rapport. */
    const d = src.indexOf('const POCKET');
    const bloc = src.slice(d, src.indexOf('});', d) + 3);
    vrai(/trad\(/.test(bloc), 'les noms de poche de l’export doivent être traduits');
    eq((bloc.match(/:\s*'[A-ZÀ-Ý][^']*'/g) || []).length, 0,
      'une chaîne française nue subsiste dans les libellés de l’export');
  });
});

suite('Le manifeste parle la langue de l’application', () => {

  /* Le manifeste porte du texte AFFICHE : le telephone le montre dans sa
     fenetre d'installation et dans le tiroir d'applications. Il echappait
     pourtant a tous les controles de langue, qui ne lisent que les trois
     fichiers JavaScript — et il en portait deux fautes a la fois.

     Il vouvoyait, « Votre patrimoine, au complet », alors qu'un test refuse
     depuis longtemps le moindre « votre » dans le texte affiche. Et il
     declarait `lang: "fr"` avec des raccourcis francais sur une demonstration
     qui s'ouvre en anglais, dont le README et les captures sont anglais.

     Un fichier qui n'est pas du code n'est pas pour autant hors des regles. */

  const manifeste = () => JSON.parse(lireSource('manifest.webmanifest'));

  test('sa langue est celle que l’application ouvre', () => {
    eq(manifeste().lang, langueParDefaut(),
      'le manifeste déclare une autre langue que celle du premier chargement');
  });

  test('le HTML livré déclare la même langue que le manifeste', () => {
    /* C'est le seul de ces reglages qu'un robot lit sans executer une ligne de
       JavaScript. `translateStatic()` corrige bien l'attribut, mais apres le
       chargement : avant ca, la demonstration se presentait en francais a tout
       ce qui ne rend pas le script — les moteurs qui n'executent rien, et un
       lecteur d'ecran pendant le premier instant.

       Le manifeste et la balise html sont donc tenus par le meme controle et la
       meme source, la langue par defaut lue dans i18n.js. Deux declarations de
       langue qui se contredisent, c'est exactement le defaut que ce projet
       traque partout ailleurs. */
    const html = lireSource('index.html');
    const m = html.match(/<html lang="([\w-]+)"/);
    vrai(m, 'la balise html doit déclarer une langue');
    eq(m[1], langueParDefaut(),
      `le HTML déclare « ${m && m[1]} » alors que l’application ouvre en `
      + `« ${langueParDefaut()} »`);
  });

  test('la page de connexion du Worker porte la même devise', () => {
    /* TROISIEME COPIE DE LA DEVISE, et celle qu'on voit en premier : c'est
       l'ecran d'accueil d'un visiteur non connecte. Le Worker construit cette
       page lui-meme, donc il ne peut appeler ni `trad()` ni le dictionnaire —
       la devise y est recopiee, exactement comme dans le manifeste.

       Elle a deja derive : l'application affichait la nouvelle devise pendant
       que la page de connexion gardait l'ancienne. Rien ne le disait, parce que
       rien ne regardait. */
    /* LA LANGUE SE DERIVE, ELLE NE SE RECOPIE PAS. Ce contrôle fixait « fr »
       en dur, donc il exigeait du français d'une page servie à un public que
       l'application accueille en anglais. Il tenait la devise et laissait
       filer la langue. `langueParDefaut()` est la même source que celle qui
       gouverne la balise `html` du document. */
    let attendu;
    enLangue(langueParDefaut(), () => {
      attendu = trad('Vois juste.') + ' <b>' + trad('Avance.') + '</b>';
    });
    const w = lireSource('_worker.js');
    vrai(w.includes(attendu),
      'la page de connexion devrait porter « ' + attendu + ' »');
    /* La page de connexion ne se traduit pas : le Worker ne sait pas quelle
       langue le visiteur a choisie, cette preference vivant dans un stockage
       auquel il n'a pas acces. Elle porte donc UNE langue, et ce ne peut etre
       que celle dans laquelle l'application ouvre — sinon le parcours bascule
       au milieu, entre l'ecran de connexion et le tableau de bord. */
    vrai(!/Suivre\. Arbitrer\.|Projeter\./.test(w),
      'et plus aucune trace de l’ancienne');
  });

  test('sa description commence par la devise de l’application', () => {
    /* La devise vit dans i18n.js, en deux morceaux que l'en-tete assemble. La
       recopier dans le manifeste en fait une deuxieme source ; ce controle rend
       la copie verifiable, faute de pouvoir l'eviter — un manifeste ne peut pas
       appeler trad(). */
    /* `enLangue` ne rend pas la valeur de son bloc : elle restaure la langue
       dans un `finally` et retourne undefined. La devise se recueille donc
       dans une variable. */
    let attendu;
    enLangue(langueParDefaut(), () => {
      attendu = trad('Vois juste.') + ' ' + trad('Avance.');
    });
    vrai(manifeste().description.startsWith(attendu),
      `la description devrait commencer par « ${attendu} », elle dit `
      + `« ${manifeste().description.slice(0, 40)} »`);
  });

  test('en français, il tutoie comme tout le reste', () => {
    const m = manifeste();
    if (m.lang !== 'fr') return;
    const textes = [m.name, m.short_name, m.description]
      .concat((m.shortcuts || []).map(s => s.name)).join(' ');
    const fautifs = [...textes.matchAll(/\b(vous|vos|votre|Vous|Vos|Votre)\b/g)]
      .map(x => x[1]);
    eq(fautifs.length, 0,
      'vouvoiement dans le manifeste : ' + fautifs.join(', '));
  });
});

suite('Les réponses du worker sont aussi protégées que les fichiers', () => {

  /* `_headers` protege ce que Cloudflare Pages sert : anti-cadrage, `nosniff`,
     politique de referent, permissions. Une reponse que `_worker.js` construit
     lui-meme n'herite de rien de tout ca — et la page de connexion, seule page
     du site ou l'on tape un mot de passe, etait donc la moins protegee des
     trois.

     Le controle ne recopie pas la liste : il la LIT dans `_headers`, le fichier
     qui la possede. Ajouter une protection la-bas la rend exigible ici sans
     toucher a ce test. */
  test('un import ne remplace rien avant d’avoir validé', () => {
    /* LE DEFAUT, ET C'ETAIT UNE PERTE DE DONNEES. L'ordre etait :
       `Store.state = data` PUIS `Store.migrate()`. Un fichier qui passait la
       garde sommaire — elle ne testait que la presence de `positions` et
       `monthly` — faisait echouer la migration APRES le remplacement. L'ecran
       annonçait « Import impossible » et le patrimoine etait deja parti : zero
       compte, zero relevé, zero euro. Le geste le plus destructeur de
       l'application etait le seul sans filet. */
    const src = lireSource('assets/app.js');
    const bloc = src.slice(src.indexOf('function mountData()'),
                           src.indexOf('function download('));
    /* La validation vient avant toute affectation. */
    /* La forme EXECUTABLE, avec son point-virgule : le commentaire au-dessus
       cite le code fautif entre accents graves, et une recherche naive le
       trouvait en premier. Un controle qui mesure la prose ne mesure rien. */
    const iValide = bloc.indexOf('n’a pas la forme d’une sauvegarde Longward.');
    const iRemplace = bloc.indexOf('Store.state = data;');
    vrai(iValide > 0 && iRemplace > 0, 'les deux étapes doivent exister');
    vrai(iValide < iRemplace, 'on valide avant de remplacer');
    /* La forme est verifiee, pas seulement la presence de deux clefs. */
    for (const garde of ['Array.isArray(data.positions)', 'Array.isArray(data.monthly)',
                         'typeof data.budget'])
      vrai(bloc.includes(garde), `la validation vérifie ${garde}`);
    /* Une sauvegarde est posée avant de toucher à quoi que ce soit. */
    const iBackup = bloc.indexOf("Store.addBackup('avant import')");
    vrai(iBackup > 0 && iBackup < iRemplace, 'une copie de secours précède le remplacement');
    /* Et la migration se rejoue en arrière si elle refuse. */
    vrai(/Store\.state = avant;/.test(bloc), 'l’état revient si la migration échoue');
    vrai(!/alert\(/.test(bloc), 'les erreurs passent par la fenêtre de l’app, pas par alert()');
  });

  test('une écriture impossible ne se tait pas', () => {
    /* `flashSaved()` vivait deja dans le `try`, donc « Sauvegardé ✓ » ne
       s'affichait pas a tort. Mais rien ne s'affichait non plus : quota plein ou
       stockage refuse, la modification vivait en memoire et disparaissait au
       rechargement, sans un mot. Le pire des silences est celui qui ressemble a
       un succes. */
    const store = lireSource('assets/store.js');
    const bloc = store.slice(store.indexOf('  save(opts = {})'),
                             store.indexOf('  canUndo()'));
    vrai(/signalerEcriture\(false, nouveau\)/.test(bloc),
      'un échec d’écriture remonte à la vue');
    vrai(/signalerEcriture\(true\)/.test(bloc), 'et le rétablissement aussi');
    vrai(bloc.indexOf('flashSaved()') < bloc.indexOf('catch'),
      '« Sauvegardé » reste dans le try : jamais affiché après un échec');
    /* Un seul message par bascule, pas un par frappe. */
    const app = lireSource('assets/app.js');
    const vue = app.slice(app.indexOf('function signalerEcritureVue'),
                          app.indexOf('function flashSaved'));
    vrai(/if \(!ok && premierEchec\)/.test(vue), 'le message ne se répète pas à chaque frappe');
    vrai(/classList\.toggle\('ko', !ok\)/.test(vue), 'mais le témoin, lui, reste');
    vrai(/\.saved\.ko/.test(lireSource('assets/styles.css')), 'et il se voit');
    for (const clef of ['Non enregistré', 'Impossible d’enregistrer sur cet appareil. Exporte une sauvegarde.',
                        'Enregistrement rétabli.'])
      vrai(I18N.en[clef], `« ${clef.slice(0, 24)} » est traduite`);
  });

  test('un état sans identité prouvée n’a pas de clef par défaut', () => {
    /* `state:default` est le cas voulu d'un propriétaire unique derrière un mot
       de passe. Ce n'est pas celui d'un site ouvert : chaque visiteur anonyme y
       tomberait sur la MEME clef. La démonstration n'a aujourd'hui aucun espace
       KV lié — `/api/state` y répond « stockage non configuré » — mais une case
       cochée dans un tableau de bord ne doit pas suffire à transformer une
       démonstration en boîte aux lettres commune. */
    const w = lireSource('_worker.js');
    const fn = w.slice(w.indexOf('async function handleState('),
                       w.indexOf('const key = keyFor(email);'));
    vrai(/if \(!identifie\) return json\(\{ error: 'identité requise' \}, 403\);/.test(fn),
      'sans identité prouvée, /api/state refuse');
    /* L'identité vient du serveur, jamais d'un en-tête que la requête se donne. */
    vrai(/const identifie = !!appIdentity \|\| !!email/.test(w),
      'elle descend de l’adresse validée ou de la session du compte');
    vrai(/tokenIsValid\(cookieValue\(request, 'wd_session'\), pwd\)/.test(w),
      'ou du cookie de session signé');
    /* Le garde-fou d'entrée et celui de l'état sont deux questions distinctes :
       `authorised` dit qui peut ENTRER, `identifie` dit qui possède un état. Ce
       dépôt-ci peut être ouvert (démonstration) ou fermé par défaut (dépôt
       principal) — la constante n'existe que dans le premier, et le contrôle ne
       l'exige donc pas. Ce qui vaut des deux côtés : une ouverture, quelle
       qu'elle soit, passe l'entrée et jamais l'état. */
    vrai(/\|\| identifie;/.test(w), 'le garde-fou d’entrée réutilise le même calcul');
    for (const ouverture of ['DEMO_PUBLIQUE && !pwd', "env.ALLOW_PUBLIC === '1'"]) {
      const i = w.indexOf(ouverture);
      if (i < 0) continue;                       // cette ouverture n'existe pas ici
      vrai(i < w.indexOf('|| identifie;'),
        `« ${ouverture} » ouvre l’entrée, et reste hors du calcul d’identité`);
    }
    vrai(w.includes("env.ALLOW_PUBLIC === '1'"), 'au moins une ouverture explicite existe');
  });

  test('la CSP dit ce que l’application a réellement le droit de faire', () => {
    const h = lireSource('_headers');
    const csp = (h.match(/Content-Security-Policy: ([^\n]*)/) || [])[1] || '';
    vrai(csp, '_headers porte une CSP');
    for (const regle of ["default-src 'self'", "script-src 'self'", "object-src 'none'",
                         "base-uri 'self'", "frame-ancestors 'none'", "connect-src 'self'"])
      vrai(csp.includes(regle), `la CSP porte « ${regle} »`);
    /* La concession, et elle est nommée : des centaines d'attributs style="" que
       l'interface calcule à chaque rendu. Le script, lui, ne cède pas. */
    vrai(csp.includes("style-src 'self' 'unsafe-inline'"), 'les styles en ligne sont admis');
    vrai(!/script-src[^;]*unsafe-inline/.test(csp), 'le script, lui, ne l’est pas');
    vrai(!/script-src[^;]*unsafe-eval/.test(csp), 'ni eval');
    /* L'app n'a aucun script en ligne exécutable : la règle est tenable. */
    const html = lireSource('index.html');
    const enLigne = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/g)]
      .filter(m => !/type="application\/ld\+json"/.test(m[0]));
    eq(enLigne.length, 0, 'aucun script en ligne exécutable dans la page');
  });

  test('chaque protection de _headers vaut aussi pour le worker', () => {
    const entetes = lireSource('_headers');
    const worker = lireSource('_worker.js');
    vrai(entetes && worker, '_headers et _worker.js doivent se lire');

    /* Le bloc `/*` de `_headers` : celui qui vaut pour tout le site. Il s'arrete
       a la premiere ligne vide ou au chemin suivant. */
    const lignes = entetes.split('\n');
    const debut = lignes.findIndex(l => l.trim() === '/*');
    vrai(debut >= 0, '_headers doit porter un bloc /* pour tout le site');
    const globales = [];
    for (let i = debut + 1; i < lignes.length; i++) {
      const l = lignes[i];
      if (!l.trim() || !/^\s/.test(l)) break;
      const m = l.match(/^\s*([\w-]+)\s*:/);
      if (m) globales.push(m[1]);
    }
    vrai(globales.length >= 3, 'le bloc global doit porter plusieurs en-têtes');

    const manquants = globales.filter(h => !worker.includes(`'${h}'`));
    eq(manquants.length, 0,
      'le worker construit ses réponses HTML sans ' + manquants.join(', ')
      + ' : la page de connexion serait moins protégée que le reste du site');
  });

  test('la page de connexion reste hors des moteurs', () => {
    /* Ajouter des en-tetes ne doit pas faire perdre celui qui etait deja la. */
    const worker = lireSource('_worker.js');
    vrai(/X-Robots-Tag['"]?\s*:\s*['"]noindex/.test(worker),
      'les réponses HTML du worker doivent rester en noindex');
  });
});

finDePartieDeTests('tests/16-performance-jour-se-compte.tests.js');
