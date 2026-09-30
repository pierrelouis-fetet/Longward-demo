partieDeTests('tests/05-charges-fixes-se-rangent.tests.js');
/* ------------------------------------------------------------------
   Les charges fixes se rangent : a la main, ou du plus cher
   ------------------------------------------------------------------ */
suite('Les charges fixes se rangent du plus cher au moins cher', () => {

  const poser = () => {
    Fixture.poser();
    Store.state.budget.fixedCharges = [
      { label: 'Loyer', amount: 900, period: 'mois' },
      { label: 'Assurance', amount: 600, period: 'an' },      // 50 / mois
      { label: 'Mobile', amount: 15, period: 'mois' },
      { label: 'Streaming', amount: 60, period: 'trimestre' }, // 20 / mois
    ];
  };

  test('le tri se fait sur l’équivalent mensuel, pas sur le montant saisi', () => {
    /* Une assurance a 600 € l'an pese 50 € par mois. La ranger devant un
       abonnement a 60 € trimestriels — 20 € par mois — est juste ; la ranger
       d'apres les 600 dirait le contraire de la colonne affichee a cote. */
    poser();
    eq(chargesOrdonnees().map(x => x.c.label).join(' '), 'Loyer Assurance Streaming Mobile',
      'du plus cher au moins cher, au mois');
    const m = chargesOrdonnees().map(x => chargeMensuelle(x.c));
    vrai(m.every((v, k) => k === 0 || m[k - 1] >= v), 'et la suite est décroissante');
  });

  test('trier est une lecture : la liste enregistrée ne bouge pas', () => {
    /* Trier en reecrivant `fixedCharges` reordonnerait les donnees a chaque
       rendu. La saisie, l'import et l'export lisent cette liste-la, et elle
       garde l'ordre ou elle est arrivee. */
    poser();
    const avant = Store.state.budget.fixedCharges.map(c => c.label).join(' ');
    chargesOrdonnees();
    chargesOrdonnees();
    eq(Store.state.budget.fixedCharges.map(c => c.label).join(' '), avant,
      'l’ordre enregistré survit au tri');
  });

  test('chaque ligne garde son rang réel dans le tableau', () => {
    /* La vue s'en sert pour ouvrir, modifier et supprimer. Sans lui, trier par
       montant ferait porter un clic sur la ligne voisine — et le defaut ne se
       verrait qu'en supprimant la mauvaise charge. */
    poser();
    const l = chargesOrdonnees();
    eq(l.length, 4, 'toutes les lignes sont rendues');
    for (const { c, i } of l) {
      eq(Store.state.budget.fixedCharges[i], c, `le rang ${i} désigne bien « ${c.label} »`);
    }
    eq([...l.map(x => x.i)].sort().join(','), '0,1,2,3', 'et aucun rang ne manque');
  });

  test('une liste vide ou d’une seule ligne se range sans rien casser', () => {
    Fixture.poser();
    Store.state.budget.fixedCharges = [];
    eq(chargesOrdonnees().length, 0, 'aucune ligne');
    Store.state.budget.fixedCharges = [{ label: 'Seule', amount: 10, period: 'mois' }];
    eq(chargesOrdonnees().length, 1, 'une ligne');
  });

  test('deux charges du même poids ne se mangent pas', () => {
    /* Un tri qui compare a zero peut echanger deux egales sans rien perdre :
       ce qui compterait, et qui se verrait a la suppression, serait qu'un rang
       disparaisse. */
    Fixture.poser();
    Store.state.budget.fixedCharges = [
      { label: 'A', amount: 50, period: 'mois' },
      { label: 'B', amount: 600, period: 'an' },
      { label: 'C', amount: 50, period: 'mois' },
    ];
    const l = chargesOrdonnees();
    eq(l.length, 3, 'les trois sont là');
    eq([...l.map(x => x.i)].sort().join(','), '0,1,2', 'et chacune garde son rang');
  });

  test('il n’y a plus qu’un ordre : le commutateur est parti', () => {
    /* Deux ordres et un commutateur pour passer de l'un a l'autre demandaient
       de choisir avant de lire. Une liste de charges se lit pour savoir ce qui
       pese, et cette reponse-la ne depend d'aucun rangement personnel. */
    const store = lireSource('assets/store.js');
    const app = lireSource('assets/app.js');
    const dico = lireSource('assets/i18n.js');
    vrai(/function chargesOrdonnees\(\) \{/.test(store),
      'la fonction ne prend plus d’ordre en paramètre');
    vrai(!/ORDRES_CHARGES/.test(store) && !/ORDRES_CHARGES/.test(app),
      'la table des deux ordres n’existe plus');
    vrai(!/let ordreCharges/.test(app), 'ni le réglage de vue');
    vrai(!/data-action="charges-ordre"/.test(app) && !/'charges-ordre'\(btn\)/.test(app),
      'ni son bouton, ni l’action qui l’écoutait');
    for (const clef of ["'Mon ordre'", "'Du plus cher'"]) {
      vrai(!dico.includes(clef), `la clef ${clef} est morte avec le commutateur`);
    }
  });

  test('le glissement part avec lui, il ne reste pas armé', () => {
    /* Il ne servait que cette liste : personne d'autre ne posait l'attribut de
       rang. Le laisser en place armerait un geste qui reordonne une liste que
       plus rien n'affiche dans cet ordre. */
    const app = lireSource('assets/app.js');
    const store = lireSource('assets/store.js');
    for (const mort of [/function monterGlissement/, /function poserOrdreCharges/,
                        /const poigneeCharge/, /class="rang-glissant"/,
                        /class="cell-poignee"/, /data-rang="/]) {
      vrai(!mort.test(app), `${mort.source} n’a plus rien à faire dans app.js`);
    }
    vrai(!/function deplacerCharge/.test(store),
      'ni la fonction qui réécrivait l’ordre dans les données');
    const css = lireSource('assets/styles.css');
    for (const mort of ['.rang-glissant', '.cell-poignee', '.liste-ordre', '.en-glissement']) {
      vrai(!css.includes(mort), `« ${mort} » est parti des styles`);
    }
  });
});

suite('Non coté : une aide qui cite ce qui existe', () => {

  const aideType = () => {
    const fr = Object.keys(FR).concat(Object.keys(I18N.en))
      .find(k => /Non coté : trois types/.test(k));
    return { fr, en: I18N.en[fr] };
  };

  test('l’aide ne cite que des libellés réellement affichés', () => {
    /* Elle citait « Unlisted » et « Participating loan », qui ne sont ni l'un ni
       l'autre a l'ecran : la classe s'appelle « Private assets » et le type
       « Crowdlending ». Une aide qui nomme des mots absents envoie chercher
       quelque chose qui n'existe pas — c'est ce qui fait douter du modele. */
    const { fr, en } = aideType();
    vrai(fr && en, 'l’aide du type de compte doit exister dans les deux langues');
    /* Les libelles se prennent a leur SOURCE, jamais traduits : `CLASSES_ACTIFS`
       passe par `trad()`, donc il rend l'anglais quand l'application tourne en
       anglais — et le controle exigeait alors que l'aide francaise cite un mot
       anglais. Les tables de types, elles, portent le francais brut. */
    const CLASSE_FR = 'Non coté';
    for (const [langue, texte, mots] of [
      ['français', fr, [CLASSE_FR,
                        typeCompte('pe').label, typeCompte('crowdfunding').label]],
      ['anglais', en, [I18N.en[CLASSE_FR],
                       I18N.en[typeCompte('pe').label],
                       I18N.en[typeCompte('crowdfunding').label]]],
    ]) {
      for (const mot of mots) {
        vrai(texte.includes(mot),
          `l’aide en ${langue} doit citer « ${mot} », qui est à l’écran`);
      }
    }
  });

  test('elle porte le mot que le détenteur a en tête', () => {
    /* « Parts de société » est le nom juste, mais personne ne dit ça : on dit
       private equity. Le mot manquait la ou la question se pose, et faire
       chercher un type qui n'existe pas est le symptome. */
    const { fr, en } = aideType();
    vrai(/private equity/i.test(fr), 'le français dit « private equity »');
    vrai(/private equity/i.test(en), 'l’anglais aussi');
  });

  test('« Company shares » ne se lit plus comme des actions cotées', () => {
    /* Le libelle anglais ne disait pas que ces parts ne cotent pas. Sous une
       classe qui s'appelle « Private assets », il fallait deviner. */
    eq(I18N.en['Parts de société'], 'Private company shares', 'le type le dit');
    vrai(/^Private/.test(I18N.en['Non coté']), 'et la classe le disait déjà');
    /* Le libelle francais ne bouge pas : « Parts de société » est le nom juste,
       et c'est celui qu'on choisit dans la liste. */
    eq(typeCompte('pe').label, 'Parts de société', 'le français reste');
  });

  test('une seule aide, pas deux qui se contredisent', () => {
    /* Une clef perimee decrivait encore « Placements non cotés » et
       « Financement participatif », deux noms de types qui n'existent plus. Une
       traduction sans emploi se garde sans se maintenir, et celle-la nommait de
       surcroit une plateforme reelle dans un fichier qui part en ligne. */
    const toutes = Object.keys(I18N.en).filter(k => /Non coté : (deux|trois) types/.test(k));
    eq(toutes.length, 1, 'une seule clef pour cette aide');
    vrai(!Object.keys(I18N.en).some(k => /« Placements non cotés » pour/.test(k)),
      'et plus aucune qui décrive des types disparus');
  });

  test('les deux types du non coté restent distincts', () => {
    /* La raison de ne PAS avoir un type « private equity » : il faudrait un nom
       coherent pour son jumeau. Capital d'un cote, pret de l'autre — l'un sort
       au rachat, l'autre a une echeance et un etat. */
    const pe = typeCompte('pe'), pret = typeCompte('crowdfunding');
    eq(pe.classes.join(), 'nonCote', '« Parts de société » tient du non coté');
    eq(pret.classes.join(), 'nonCote', '« Prêt participatif » aussi');
    vrai(!pe.prete, 'le capital ne se rembourse pas à une date');
    vrai(pret.prete, 'le prêt, si');
    vrai(pe.parts && !pret.parts, 'et seul le capital se compte en parts');
  });
});

/* ------------------------------------------------------------------
   Un fonds non cote a une VL, et elle se perime a sa cadence
   ------------------------------------------------------------------ */
suite('Fonds non coté : une valeur publiée, pas estimée', () => {

  const ilYA = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

  test('trois types pour trois choses réellement différentes', () => {
    /* Du capital dans une entreprise nommee, des parts d'un fonds, un pret a
       taux et echeance. Le troisieme type ne double pas le premier : ce qu'on
       detient n'est pas la meme chose, et les champs qu'il faut le disent. */
    const f = typeCompte('fondsNonCote'), pe = typeCompte('pe'), pr = typeCompte('crowdfunding');
    for (const t of [f, pe, pr]) {
      eq(t.classes.join(), 'nonCote', `« ${t.label} » tient du non coté`);
      vrai(estActifTerminal(t), `« ${t.label} » ne porte pas de sous-placement`);
    }
    vrai(f.vl && !pe.vl && !pr.vl, 'seul le fonds publie une valeur liquidative');
    vrai(pr.prete && !f.prete && !pe.prete, 'seul le prêt se rembourse à une date');
    vrai(f.parts && pe.parts && !pr.parts, 'les deux capitaux se comptent en parts');
  });

  test('le nom dit la structure, jamais le thème', () => {
    /* « Private equity » aurait ete plus reconnaissable et plus faux : ces fonds
       vont du capital-risque a l'infrastructure, et le meme contenant les porte
       tous. Un type nomme ce qu'on ouvre. */
    eq(typeCompte('fondsNonCote').label, 'Fonds non coté', 'le français');
    eq(I18N.en['Fonds non coté'], 'Private markets fund', 'et l’anglais');
    vrai(!TYPES_COMPTE.some(t => /private equity/i.test(t.label)),
      'aucun type ne porte le nom d’un thème');
  });

  test('une VL se lit, elle ne s’estime pas', () => {
    /* La ranger sous « Valeur estimée » ferait passer un chiffre publie pour une
       opinion, ce qui est exactement l'inverse de ce qu'il est.

       Le harnais ne charge pas la vue : ces controles-la lisent la source. */
    const app = lireSource('assets/app.js');
    /* LE PREDICAT S'EST ELARGI, LA REGLE N'A PAS BOUGE. `estValeurEstimee`
       couvre ce qu'on détient en direct ET la part de société, qui se valorise
       soi-même autant qu'une montre. Une VL, elle, n'en est toujours pas :
       c'est ce que la ligne suivante vérifie. */
    vrai(/const estime = estValeurEstimee\(type\);/.test(app),
      '« estimé » ne vaut que pour ce qu’on apprécie soi-même');
    vrai(!estValeurEstimee(TYPES_COMPTE.find(t => t.id === 'fondsNonCote')),
      'et une VL publiée n’est pas une opinion');
    vrai(/const publiee = !!\(type && type\.vl\);/.test(app),
      'et « publié » est une autre question');
    vrai(/const datee = estime \|\| publiee;/.test(app),
      'la date, elle, vaut pour les deux');
    vrai(/publiee \? 'la dernière valeur liquidative publiée/.test(app),
      'l’aide du montant nomme la VL quand c’en est une');
  });

  test('le champ de date porte le nom de ce qu’il date', () => {
    const app = lireSource('assets/app.js');
    vrai(/label: trad\(publiee \? 'VL du' : 'Estimée le'\)/.test(app),
      'le champ porte le nom de ce qu’il date');
    /* Il ne parait que sur ce qui porte une valeur datee : un pret n'en a pas,
       son nominal ne bouge pas. */
    vrai(/\.\.\.\(datee \? \[\{ cle: 'estimeLe'/.test(app),
      'et seulement là où une valeur est datée');
    /* Un seul champ pour les deux natures : un second serait deux ecritures du
       meme fait, la date a laquelle ce chiffre a ete etabli. */
    vrai(!/cle: 'vlLe'|cle: 'dateVL'/.test(app), 'aucun second champ de date');
  });

  test('la cadence n’est demandée qu’à ce qui publie', () => {
    const app = lireSource('assets/app.js');
    vrai(/\.\.\.\(publiee \? \[\{ cle: 'vlPeriode'/.test(app),
      'la cadence suit le drapeau du type');
    vrai(/valeur: l \? \(l\.vlPeriode \|\| 'trimestre'\) : 'trimestre'/.test(app),
      'et le trimestre est le défaut');
    /* Un seul type publie une VL aujourd'hui, et le drapeau le dit. */
    eq(TYPES_COMPTE.filter(t => t.vl).map(t => t.id).join(), 'fondsNonCote',
      'et lui seul porte le drapeau');
    for (const id of ['pe', 'crowdfunding', 'bienValeur', 'immo']) {
      vrai(!typeCompte(id).vl, `« ${typeCompte(id).label} » ne publie rien`);
    }
  });

  test('une VL se périme au rythme où elle est publiée', () => {
    /* Sans cadence, un fonds mensuel serait declare a jour pendant onze mois.
       Avec, la peremption suit ce que le fonds fait vraiment. */
    const f = typeCompte('fondsNonCote');
    vrai(!valeurPerimee({ estimeLe: ilYA(30), vlPeriode: 'mois' }, f),
      'une VL mensuelle d’il y a un mois est fraîche');
    vrai(valeurPerimee({ estimeLe: ilYA(60), vlPeriode: 'mois' }, f),
      'à deux mois elle est dépassée');
    vrai(!valeurPerimee({ estimeLe: ilYA(60), vlPeriode: 'trimestre' }, f),
      'une trimestrielle à deux mois ne l’est pas');
    vrai(valeurPerimee({ estimeLe: ilYA(120), vlPeriode: 'trimestre' }, f),
      'à quatre mois, si');
    /* La marge d'un cycle : une VL trimestrielle publiee fin mars n'est pas
       perimee le 1er juillet, elle attend la publication suivante. */
    vrai(!valeurPerimee({ estimeLe: ilYA(95), vlPeriode: 'trimestre' }, f),
      'et elle attend la publication suivante avant d’être dite dépassée');
  });

  test('la règle d’un an tient pour ce qui s’estime', () => {
    /* Le fonds ne devait pas emporter le reste avec lui : une montre se revoit
       une fois l'an, et c'est toujours vrai. */
    const b = typeCompte('bienValeur');
    vrai(!valeurPerimee({ estimeLe: ilYA(200) }, b), 'une montre à six mois va bien');
    vrai(valeurPerimee({ estimeLe: ilYA(500) }, b), 'à seize mois elle se revoit');
    /* Sans date, on ne sait pas : donc a revoir. */
    vrai(valeurPerimee({}, b), 'sans date, à revoir');
    vrai(valeurPerimee(null, b), 'et une ligne absente ne fait pas tomber le calcul');
    /* Un fonds sans cadence declaree retombe sur le trimestre. */
    vrai(valeurPerimee({ estimeLe: ilYA(120) }, typeCompte('fondsNonCote')),
      'un fonds sans cadence suit le trimestre');
  });

  test('un seul endroit décide de la péremption', () => {
    /* Deux ecrans la lisent : la carte de la plus-value non cotee et le compte
       « a revoir » qui la surmonte. Ecrite deux fois, l'une aurait garde le
       seuil d'un an pendant que l'autre suivait la cadence, et le compte aurait
       cesse d'egaler la liste qu'il annonce. */
    const st = lireSource('assets/store.js');
    eq((st.match(/function valeurPerimee\(/g) || []).length, 1, 'une seule définition');
    vrai(/vieille: valeurPerimee\(l, typeCompte\(c\.type\)\)/.test(st),
      'et la carte la lit plutôt que de refaire le calcul');
    vrai(!/ageAnnees\(l\.estimeLe\) >= 1/.test(st),
      'plus de seuil d’un an écrit à la main à côté');
  });

  test('la valeur perdue se compte comme la liste qu’elle annonce', () => {
    /* Un total egale la somme de ses parts, ici aussi : « 2 à revoir » doit
       designer exactement deux lignes de la liste. */
    Fixture.poser(s => {
      const c = s.comptes.find(x => x.id === 'c_pe');
      c.type = 'fondsNonCote';
      c.lignes = [
        { id: 'f1', classe: 'nonCote', libelle: 'Fonds A', valeur: 1000,
          prixDeRevient: 900, quantite: 1, estimeLe: ilYA(20), vlPeriode: 'mois' },
        { id: 'f2', classe: 'nonCote', libelle: 'Fonds B', valeur: 2000,
          prixDeRevient: 1800, quantite: 1, estimeLe: ilYA(200), vlPeriode: 'mois' },
      ];
    });
    const d = latentNonCote();
    eq(d.aRevoir, d.lignes.filter(x => x.vieille).length,
      'le compte annoncé est celui des lignes marquées');
    /* Sur les deux fonds seulement : le fixture porte par ailleurs un bien sans
       date d'estimation, qui est a revoir lui aussi et pour une autre raison. */
    const fonds = d.lignes.filter(x => /^Fonds /.test(x.nom));
    eq(fonds.length, 2, 'les deux fonds sont dans la carte');
    eq(fonds.filter(x => x.vieille).length, 1,
      'une seule de leurs deux VL mensuelles est dépassée');
    vrai(fonds.find(x => x.nom === 'Fonds B').vieille, 'celle de deux cents jours');
  });
});

/* ------------------------------------------------------------------
   Une charge porte une echeance ; la periodicite deduit les suivantes
   ------------------------------------------------------------------ */
suite('Échéance des charges fixes : une date déclarée, les suivantes calculées', () => {

  const p = (date, per, auj) => prochaineEcheance({ echeanceLe: date, period: per }, auj);

  test('la suivante se déduit de la périodicité', () => {
    /* Un equivalent mensuel dit combien, jamais quand. Une charge semestrielle
       de 480 € pese 80 € par mois dans le budget et n'en sort aucun onze mois
       sur douze. */
    eq(p('2026-01-15', 'trimestre', '2026-03-01'), '2026-04-15', 'trimestre suivant');
    eq(p('2026-01-15', 'trimestre', '2026-04-20'), '2026-07-15', 'et celui d’après');
    eq(p('2026-02-15', 'an', '2026-08-30'), '2027-02-15', 'l’an prochain');
    eq(p('2026-01-05', 'semaine', '2026-01-20'), '2026-01-26', 'la semaine se compte en jours');
  });

  test('un 31 ne déborde pas sur le mois suivant', () => {
    /* Le 31 janvier plus un mois n'est pas le 3 mars. `setMonth()` reporte le
       debordement en silence, et une charge partant d'un 31 derivait d'un jour
       a chaque saut. */
    eq(p('2026-01-31', 'mois', '2026-02-01'), '2026-02-28', 'février se borne à son dernier jour');
    eq(p('2026-01-31', 'semestre', '2026-03-01'), '2026-07-31', 'et juillet retrouve le 31');
    /* Un 29 fevrier bissextile, vu une annee ordinaire. */
    eq(p('2024-02-29', 'an', '2026-01-01'), '2026-02-28', 'le 29 février se borne au 28');
  });

  test('le calcul repart de l’origine, jamais de la précédente', () => {
    /* Additionner des mois de proche en proche ferait deriver le jour des qu'un
       mois court est traverse : un 31 janvier deviendrait 28 fevrier, puis 28
       mars, puis 28 avril. En repartant de l'origine, mars retrouve son 31. */
    eq(p('2026-01-31', 'mois', '2026-03-01'), '2026-03-31',
      'mars revient au 31 après un février borné');
    eq(p('2026-01-31', 'mois', '2026-04-01'), '2026-04-30', 'avril n’a que 30 jours');
    eq(p('2026-01-31', 'mois', '2026-05-01'), '2026-05-31', 'et mai retrouve le 31');
  });

  test('une date déjà à venir ne bouge pas, et aucune n’est inventée', () => {
    eq(p('2027-05-10', 'an', '2026-08-30'), '2027-05-10', 'une date future se rend telle quelle');
    eq(p('2026-08-30', 'an', '2026-08-30'), '2026-08-30', 'le jour même compte encore');
    eq(p('', 'an', '2026-08-30'), null, 'sans date, rien à déduire');
    eq(prochaineEcheance(null, '2026-08-30'), null, 'ni pour une charge absente');
    eq(p('pas-une-date', 'an', '2026-08-30'), null, 'ni pour une saisie illisible');
  });

  test('la date déclarée n’est jamais réécrite', () => {
    /* Stocker « la prochaine » et la faire avancer toute seule reviendrait a
       ecrire dans les donnees du detenteur sans qu'il l'ait demande, et une date
       qu'on n'a pas saisie soi-meme ne se verifie plus. Meme parti que la
       projection d'un credit : on rejoue, on propose, on n'ecrit pas. */
    const c = { echeanceLe: '2026-01-15', period: 'trimestre' };
    prochaineEcheance(c, '2027-06-01');
    eq(c.echeanceLe, '2026-01-15', 'la charge est intacte après le calcul');
    const st = lireSource('assets/store.js');
    const i = st.indexOf('function prochaineEcheance(');
    const fn = st.slice(i, st.indexOf('\n}', i));
    vrai(!/c\.echeanceLe =/.test(fn), 'et la fonction n’écrit nulle part');
  });

  test('les trois fenêtres de charge portent le champ', () => {
    /* Les trois ecrivent dans `budget.fixedCharges` : une seule liste, donc le
       meme champ partout. Celle qui l'aurait oublie aurait cree des lignes que
       les deux autres savent dater et pas elle. */
    const app = lireSource('assets/app.js');
    eq((app.match(/cle: 'echeanceLe', label: trad\('Prochaine échéance'\)/g) || []).length, 3,
      'création, édition, et charge d’un bien');
    eq((app.match(/echeanceLe: v\.echeanceLe \|\| ''/g) || []).length, 2,
      'les deux créations l’enregistrent');
    vrai(/c\.echeanceLe = v\.echeanceLe \|\| '';/.test(app), 'et l’édition aussi');
  });

  test('la périodicité se traduit et s’accorde', () => {
    /* Deux defauts en un mot. Le libelle n'etait pas traduit : l'interface
       anglaise affichait « billed annuel ». Et « facturee semestriel »
       n'accorde pas — la table porte des adjectifs masculins, justes dans le
       menu « Facturé : semestriel », faux apres un participe feminin. */
    for (const [cle, lib] of CHARGE_PERIODES) {
      vrai(I18N.en[lib], `« ${lib} » (${cle}) doit avoir un anglais`);
    }
    const app = lireSource('assets/app.js');
    vrai(/: trad\(CHARGE_PERIODE_LABEL\[chargePeriode\(c\)\]\),/.test(app),
      'le sous-titre traduit la périodicité');
    vrai(!/trad\('facturée'\) \} \$\{CHARGE_PERIODE_LABEL/.test(app),
      'et ne la fait plus suivre un participe qu’elle n’accorde pas');
  });

  test('une date d’une autre année dit son année, une seule fois', () => {
    /* « 31 janv. » lu un 30 aout ne dit pas s'il s'agit du 31 janvier passe ou
       du prochain, et l'ecart est de onze mois. Un seul appelant l'ajoutait a
       la main en tranchant la chaine ISO ; la regle vit dans le formateur. */
    const st = lireSource('assets/store.js');
    const i = st.indexOf('function fmtJourMois(');
    const fn = st.slice(i, st.indexOf('\n}', i));
    vrai(/a !== new Date\(\)\.getFullYear\(\)/.test(fn),
      'l’année ne paraît que si elle n’est pas celle-ci');
    const app = lireSource('assets/app.js');
    vrai(!/fmtJourMois\([^)]*\)\} \$\{String\([^)]*\)\.slice\(0, 4\)\}/.test(app),
      'et plus personne ne la recolle à la main');
  });
});

/* ------------------------------------------------------------------
   Deux a quatre mots valent mieux qu'une pastille
   ------------------------------------------------------------------ */
suite('Aperçu : une aide seulement quand le wording ne suffit pas', () => {

  test('« mois clos » se suffit, la justification s’en va', () => {
    /* « Clos » porte deja le fait : le mois en cours ne compte pas. La bulle
       n'ajoutait que la justification — il est incomplet, il bougerait chaque
       jour — et une justification ne se lit pas sur l'ecran d'accueil.

       C'est un retour sur un choix pose au meme endroit, et assume : le choix
       d'alors etait de sortir la justification de la prose vers l'aide, pas de
       garantir qu'elle merite un point d'interrogation sur cet ecran. */
    const app = lireSource('assets/app.js');
    const i = app.indexOf("trad('Croissance observée calculée sur les')");
    vrai(i > 0, 'la note de méthode doit être trouvable');
    const note = app.slice(i, app.indexOf('</p>', i));
    vrai(/derniers mois clos/.test(note), 'le mot « clos » reste');
    vrai(!/aide\(/.test(note), 'et la pastille qui le justifiait s’en va');
    /* Le motif se veut EXACT : une autre clef, toujours en usage ailleurs,
       contient la meme phrase dans un texte plus long. Un controle trop large
       aurait reclame la suppression d'une traduction vivante. */
    vrai(!Object.keys(I18N.en).some(k =>
      k.includes('Le mois en cours est écarté : il est incomplet')),
      'sa traduction part avec elle');
  });

  test('« observées » dit sur quoi, en trois mots', () => {
    /* « Depenses observees » ne disait pas observees sur quoi : c'est cela qui
       manquait, pas une phrase. Un sous-titre le dit sans rien a ouvrir. */
    const app = lireSource('assets/app.js');
    vrai(/const sousDepenses = trad\(rec\.spendObserved\s*\n?\s*\? 'moyenne de l’année' : 'aucune dépense saisie'\);/.test(app),
      'le sous-titre remplace la bulle');
    vrai(/\$\{esc\(nomDepenses\)\}<span class="sub">\$\{esc\(sousDepenses\)\}<\/span>/.test(app),
      'et se rend sous l’intitulé');
    eq(I18N.en['moyenne de l’année'], 'average for the year', 'il se traduit');
    eq(I18N.en['aucune dépense saisie'], 'no spending entered', 'dans ses deux branches');
  });

  test('ce qui reste expliqué l’est parce qu’un libellé n’y suffit pas', () => {
    /* La regle : une pastille survit quand elle porte un CALCUL avec ses
       nombres, une convention de mesure, ou une notion technique. Pas quand
       deux mots la remplacent. Les quatre retirees etaient du second genre ;
       celles qui restent montrent leur arithmetique ou definissent une moyenne
       sur une fenetre. */
    const app = lireSource('assets/app.js');
    const i = app.indexOf('function carteAccumulation()');
    const carte = app.slice(i, app.indexOf('\n}', app.indexOf('return `', i)));
    /* Les trois aides qui montrent leur calcul le montent avec le formateur
       texte, jamais avec celui qui rend du balisage. */
    for (const cle of ['aideCapacite', 'aideTotal', 'aideTaux']) {
      vrai(new RegExp(`const ${cle} =`).test(app), `« ${cle} » reste`);
    }
    vrai(/aide\(trad\('La part de tes mensualités qui rembourse le capital/.test(carte),
      'l’amortissement d’un crédit garde son aide');
    /* Et les intitules qui ne sont que des montants saisis n'en ont jamais eu. */
    const rev = carte.indexOf("trad('Revenus fixes')");
    vrai(!/\$\{aide\(/.test(carte.slice(rev, carte.indexOf('</dt>', rev))),
      'un montant saisi n’explique rien');
  });
});


/* ------------------------------------------------------------------
   La premiere carte d'Allocation se lit, elle ne se touche pas
   ------------------------------------------------------------------ */
suite('Allocation : une carte de synthèse, sans porte', () => {

  const carte = () => {
    const app = lireSource('assets/app.js');
    const i = app.indexOf('const disponibilite = [');
    return app.slice(i, app.indexOf('<dl class="kv repart-pied">', i));
  };

  test('le libellé de la première poche suit le périmètre', () => {
    /* La poche n'est pas la meme chose des deux cotes. En vue financiere elle ne
       contient que du placement, et « Investi » la nomme juste. En vue globale
       elle porte aussi les murs, la montre et la voiture : les appeler
       « investi » ferait passer un logement pour un placement, ce qu'il n'est
       pas pour qui l'habite. */
    vrai(/label: allocFinancier \? BASES\.place\.nom : trad\('Placements et biens'\)/.test(carte()),
      'le nom dépend du périmètre affiché');
    eq(I18N.en['Placements et biens'], 'Investments & assets', 'et se traduit');
    eq(I18N.en['Placements'], 'Investments', 'comme son jumeau financier');
    /* `BASES.place.nom` ne bouge pas : deux autres fiches le lisent, et il y
       designe bien des placements. */
    const st = lireSource('assets/store.js');
    vrai(/place:\s+\{ nom: trad\('Placements'\)/.test(st), 'la base garde son nom');
  });

  test('aucune des quatre rangées n’ouvre quoi que ce soit', () => {
    /* Elles etaient des boutons : chacune ouvrait une fiche, et la page gagnait
       un niveau de navigation dont elle n'a pas besoin. Le detail par classe vit
       dans le camembert juste dessous, la gestion des comptes appartient a
       Actifs. Une page qui sert a lire une repartition n'est pas un menu. */
    const c = carte();
    vrai(/<div class="repart-ligne repart-inerte">/.test(c), 'ce sont des div');
    vrai(!/<button[^>]*repart-ligne/.test(c), 'et non des boutons');
    vrai(!/data-action/.test(c), 'aucune action');
    vrai(!/data-apercu/.test(c), 'aucune fiche à ouvrir');
    vrai(!/apercu: '/.test(c), 'ni dans la description des lignes');
    /* Ni une infobulle qui promettrait un detail. */
    vrai(!/Voir le détail de/.test(c), 'ni infobulle qui promette un détail');
  });

  test('rien ne s’annonce comme une porte : ni curseur, ni survol, ni focus', () => {
    /* Des balises neutres et non des boutons desactives : un bouton inactif
       reste un bouton pour qui navigue au clavier, et un bouton dont on retire
       seulement l'action garde son curseur, son survol et son focus. */
    const c = carte();
    vrai(!/tabindex/.test(c), 'aucun élément focalisable');
    const css = lireSource('assets/styles.css');
    vrai(/\.repart-inerte \{ cursor: default; \}/.test(css), 'le curseur reste neutre');
    vrai(/\.repart-inerte:hover \.repart-nom \{ color: inherit; \}/.test(css),
      'et le survol ne colore rien');
    /* La classe de base est partagee avec la liste de l'accueil, qui ouvre bien
       une fiche : son curseur et son survol ne doivent pas disparaitre. */
    vrai(/\.repart-ligne \{[^}]*cursor: pointer/.test(css),
      'la liste de l’accueil garde les siens');
  });

  test('la fiche et la fonction qu’elle seule appelait ont disparu', () => {
    /* Une fonction sans appelant se garde sans se maintenir, et finit par
       decrire un ecran qui n'existe plus. */
    const app = lireSource('assets/app.js');
    const st = lireSource('assets/store.js');
    vrai(!/investiTotal/.test(app), 'la fiche s’en va');
    vrai(!/placeByAccount/.test(app + st),
      'et la fonction dont elle était le seul appelant');
    /* Les deux blocs de prose qui la decrivaient partent avec elle : ils ne
       portaient pas son nom, une recherche par identifiant les manquait. */
    vrai(!/Le meme decoupage par compte/.test(st), 'sa prose aussi');
  });

  test('tout ce que la carte montrait, elle le montre encore', () => {
    const c = carte();
    vrai(/fmtEUR0\(dispoArrondie\[i\]\)/.test(c), 'les montants, à l’euro et réconciliés');
    vrai(/fmtPct\(x\.pct, 1\)/.test(c), 'les pourcentages');
    vrai(/class="repart-barre"/.test(c), 'les barres');
    /* Les trois poches de cash, nommees par le modele et non ecrites ici. */
    vrai(/pochesLiquidites\(\)\.map/.test(c), 'les trois poches de liquidités');
    /* Et la base, sous la carte. */
    const app = lireSource('assets/app.js');
    vrai(/\$\{baseAlloc\(\)\.nom\}/.test(app), 'la base reste nommée sous la carte');
  });

  test('le reste de la page ne bouge pas', () => {
    const app = lireSource('assets/app.js');
    vrai(/id="aMacro"/.test(app), 'le camembert Répartition reste');
    vrai(/id="aAsset"/.test(app), 'le classement par catégorie aussi');
    /* La bascule ne s'ecrit pas en `data-action` dans la vue : elle passe son
       action au composant qui la rend. On la cherche donc telle qu'elle est
       ecrite, pas telle qu'elle sortira. */
    vrai(/'alloc-base', 'base'\)/.test(app), 'et la bascule Tout / Financier');
  });
});

/* ------------------------------------------------------------------
   Le journal annonce la variation de l'annee qu'on regarde
   ------------------------------------------------------------------ */
suite('Variation de l’année : la somme des écarts qu’on a sous les yeux', () => {

  /* Les ecarts du journal, rejoues depuis les donnees : le meme calcul que la
     vue, dont le harnais ne charge pas le code. */
  const ecarts = () => {
    const rows = Store.state.monthly.filter(r => !rowIsEmpty(r))
      .slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
    let avant = null;
    return rows.map(r => {
      const net = rowNet(r);
      const d = { date: r.date, net, dlt: avant == null ? 0 : net - avant };
      avant = net;
      return d;
    });
  };
  const variationDe = a => ecarts().filter(x => String(x.date).startsWith(a))
    .reduce((s, x) => s + x.dlt, 0);

  const poser = (paires) => {
    Fixture.poser();
    const id = Store.state.comptes[0].id;
    Store.state.monthly = paires.map(([d, v]) =>
      ({ date: d, comment: '', dettes: 0, v: { [id]: v } }));
  };

  test('elle vaut la somme des écarts affichés', () => {
    /* La liste montre douze variations sans jamais dire ce qu'elles font
       ensemble, et personne ne les additionne de tete. Un total egale la somme
       de ses parts, ici plus qu'ailleurs puisque les parts sont sous les yeux. */
    poser([['2025-12-31', 10000],
           ['2026-01-31', 10120], ['2026-02-28', 9790], ['2026-03-31', 12190]]);
    const e = ecarts().filter(x => x.date.startsWith('2026'));
    eq(e.map(x => Math.round(x.dlt)).join(' '), '120 -330 2400', 'les trois écarts');
    pres(variationDe('2026'), 120 - 330 + 2400, 'et leur somme');
  });

  test('elle se télescope : dernier de l’année moins dernier d’avant', () => {
    /* C'est la propriete qui rend le chiffre lisible : il ne depend pas du
       nombre de releves, seulement des deux bouts. */
    poser([['2025-12-31', 10000],
           ['2026-01-31', 10120], ['2026-02-28', 9790], ['2026-03-31', 12190]]);
    pres(variationDe('2026'), 12190 - 10000, 'mars moins décembre');
  });

  test('la première année du journal part de son premier relevé', () => {
    /* Le premier releve n'a rien avant lui : son ecart vaut zero, et la
       variation part donc de lui. C'est la seule chose vraie qu'on puisse en
       dire — pretendre mesurer depuis un point qui n'existe pas serait
       inventer une donnee. */
    poser([['2026-01-31', 10000], ['2026-06-30', 12000]]);
    eq(Math.round(ecarts()[0].dlt), 0, 'le premier écart est nul');
    pres(variationDe('2026'), 2000, 'et la variation vaut la montée depuis lui');
  });

  test('chaque année a la sienne, et elles ne se mélangent pas', () => {
    poser([['2025-06-30', 5000], ['2025-12-31', 10000],
           ['2026-06-30', 12000], ['2026-12-31', 15000]]);
    pres(variationDe('2025'), 5000, 'en 2025, depuis le premier relevé');
    pres(variationDe('2026'), 5000, 'en 2026, décembre à décembre');
    /* Et la somme des deux fait le trajet complet. */
    pres(variationDe('2025') + variationDe('2026'), 15000 - 5000,
      'les deux années font le trajet entier');
  });

  test('sans relevé dans l’année, rien ne s’affiche', () => {
    /* Un « +0 € » sous une liste vide se lirait comme une mesure. */
    const app = lireSource('assets/app.js');
    /* Plus strict qu'« avec des lignes » : un seul relevé, sans précédent,
       affichait « +0 € », une variation inventée. Il faut un relevé qui ait un avant. */
    vrai(/\$\{lignes\.some\(x => x\.mois > 0\) \? \(\(\) => \{/.test(app),
      'le bloc ne se rend qu’avec un relevé qui ait un précédent');
  });

  test('un seul calcul, lu deux fois', () => {
    /* La couleur et le montant venaient de deux `reduce` identiques : deux
       ecritures d'un meme nombre finissent par diverger le jour ou l'une est
       modifiee seule. */
    /* L'ancre porte sur le bloc du chiffre, pas sur la colonne qui l'entourait :
       celle-ci a disparu quand le chiffre est monte a hauteur du titre. */
    const app = lireSource('assets/app.js');
    const i = app.indexOf('<div class="card-head tete-triple">');
    vrai(i > 0, 'la tête doit être trouvable');
    /* La borne de fin est du CODE : le depot public est servi sans
       commentaires, et une tranche bornee par l'un d'eux y serait vide. */
    const bloc = app.slice(i, app.indexOf("${pasAFaire('comptes')", i));
    eq((bloc.match(/lignes\.reduce\(/g) || []).length, 1, 'un seul reduce');
    vrai(/const variation = lignes\.reduce\(\(s, x\) => s \+ x\.dlt, 0\);/.test(bloc),
      'et il se nomme');
    vrai(/cls\(variation\)/.test(bloc) && /fmtSigned\(variation\)/.test(bloc),
      'la couleur et le montant le lisent tous deux');
    /* La somme porte sur `lignes`, celles-la memes que la liste rend : prendre
       `tous` compterait les autres annees. */
    vrai(!/tous\.reduce\(/.test(bloc), 'et sur les lignes de l’année affichée');
  });

  test('elle se pose tout en haut à droite, à hauteur du titre', () => {
    /* Elle a d'abord vecu dans une colonne au-dessus des commandes, ce qui la
       laissait a mi-hauteur de la carte. Sa place est la ligne du titre : c'est
       le chiffre qui resume la liste, il se lit avant elle.

       La tete porte donc trois blocs — titre, chiffre, commandes — et
       `.card-head` est en `nowrap` partout ailleurs, a juste titre : deux blocs
       y tiennent toujours. A trois, il faut le laisser passer a la ligne, sinon
       les commandes se compriment contre le chiffre sur un telephone. */
    const app = lireSource('assets/app.js');
    const i = app.indexOf('<div class="card-head tete-triple">');
    vrai(i > 0, 'la tête déclare qu’elle porte trois blocs');
    const tete = app.slice(i, app.indexOf("${pasAFaire('comptes')", i));
    vrai(tete.indexOf('tete-titre') < tete.indexOf('tete-variation'),
      'le titre vient avant le chiffre');
    vrai(tete.indexOf('tete-variation') < tete.indexOf('class="row"'),
      'et le chiffre avant les commandes');
    vrai(!/tete-droite/.test(app), 'la colonne intermédiaire a disparu');

    const css = lireSource('assets/styles.css');
    vrai(/\.tete-triple \{ flex-wrap: wrap; \}/.test(css),
      'cette tête-là passe à la ligne');
    vrai(/\.tete-triple > \.tete-variation \{ margin-left: auto; \}/.test(css),
      'le chiffre se pousse au bord droit');
    vrai(/\.tete-triple > \.row \{ flex-basis: 100%; \}/.test(css),
      'et les commandes prennent la ligne suivante entière');
    /* La regle reste locale : les autres en-tetes ne passent pas a la ligne. */
    vrai(!/^\.card-head \{[^}]*flex-wrap/m.test(css),
      'les autres en-têtes gardent leur nowrap');
  });

  test('le mot se traduit', () => {
    eq(I18N.en['Variation {a}'], '{a} change', 'et garde son année interpolée');
    vrai(/\{a\}/.test(I18N.en['Variation {a}']), 'le gabarit survit à la traduction');
  });
});

suite('Pièges de source', () => {

  /* Ces deux-là ne se voient pas à l'exécution : ils cassent le fichier au
     chargement, donc aucun test de calcul ne tourne pour les signaler. Le
     contrôle lit le texte du source, ce qui est le seul moyen de les prendre.
     Les deux se sont produits pour de vrai, deux jours de suite. */

  const lire = lireSource;
  const source = lire('assets/app.js');

  /* Les tables de routage vivent dans app.js, que le harnais ne charge pas : on
     les reconstruit depuis la source. Ce sont des litteraux, donc `new Function`
     les rend tels quels, commentaires compris. */
  const litteral = nom => {
    const m = source.match(new RegExp(`const ${nom} = (\\{[\\s\\S]*?\\n\\});`));
    vrai(m, `la table ${nom} doit être trouvable dans la source`);
    return new Function('return ' + m[1])();
  };

  /* Le texte qui part à l'écran, une fois retirées les zones que personne ne
     lit : commentaires JavaScript et commentaires HTML. Sans ce tamis, la
     règle ci-dessous compterait 151 tirets là où neuf seulement s'affichaient. */
  const texteAffiche = s => {
    let t = s;
    for (const motif of [/\/\*[\s\S]*?\*\//g, /^[ \t]*\/\/.*$/gm, /<!--[\s\S]*?-->/g])
      t = t.replace(motif, m => ' '.repeat(m.length));
    return t;
  };

  test('chaque fichier de l’application se parse', () => {
    /* Le trou de la couverture : tests.html ne charge pas app.js, donc une
       erreur de syntaxe y passait tous les tests au vert pendant que
       l'application entiere refusait de demarrer. C'est arrive : un \n ecrit
       via un script est devenu un vrai retour a la ligne au milieu d'un
       litteral de chaine, 65 tests verts, page morte.
       new Function compile sans executer : une SyntaxError echoue ici. */
    for (const f of ['assets/app.js', 'assets/store.js', 'assets/charts.js',
                     'assets/cloudsync.js', 'assets/quotes.js', 'assets/i18n.js']) {
      const s = lire(f);
      vrai(s, f + ' doit être lisible');
      try { new Function(s); }
      catch (e) { vrai(false, f + ' ne se parse pas : ' + e.message); }
    }
  });

  test('aucun backtick dans un commentaire HTML', () => {
    /* Un commentaire HTML pose a l'interieur d'un litteral de gabarit est du
       texte comme un autre : un backtick y ferme la chaine et le fichier
       entier cesse de parser.

       Un controle qui ne regarderait qu'`app.js` laisserait passer le meme
       backtick pose dans un commentaire de `charts.js` : tous les graphiques de
       l'application se videraient -- trace is not defined -- et la suite
       resterait verte, le fichier n'etant pas dans la liste.

       La liste couvre donc tout ce qui batit du balisage dans un litteral. Le
       controle de parse, juste au-dessus, connait deja ces fichiers : c'est la
       meme liste, et elle vit ici parce qu'aucune des deux ne peut se deriver
       de l'autre sans devenir fausse le jour ou un fichier cessera de produire
       du HTML. */
    const fautifs = [];
    for (const f of ['assets/app.js', 'assets/charts.js', 'assets/store.js',
                     'assets/quotes.js', 'assets/i18n.js', 'assets/cloudsync.js']) {
      const src = lireSource(f);
      vrai(src, f + ' doit être lisible pour ce contrôle');
      for (const m of src.matchAll(/<!--[\s\S]*?-->/g))
        if (m[0].includes('`'))
          fautifs.push(`${f}:${src.slice(0, m.index).split('\n').length}`);
    }
    eq(fautifs.length, 0, 'backtick dans un commentaire HTML : ' + fautifs.join(', '));
  });

  test('geler le fond ne rogne pas la page', () => {
    /* L'arriere-plan reste visible derriere une feuille ouverte depuis une carte
       situee en bas d'une page longue : rien ne doit etre noir au-dessus d'elle.

       `gelerFond()` pose `position: fixed` sur le corps avec un decalage negatif
       egal au defilement. Y ajouter `overflow: hidden` ferait du corps une boite
       de rognage : un corps fixe sans hauteur prendrait alors celle de l'ecran.
       Page defilee a 1 833 px, le corps mesurerait 812 px au lieu de 2 937 et
       couvrirait la bande -1833 a -1021, donc rien de ce qui est visible ne
       serait peint.

       Invisible tant qu'on n'a pas defile -- a `top: 0` la boite coincide avec
       l'ecran -- ce defaut ne se montre que sur une carte situee en bas d'une
       page longue.

       `overflow: hidden` est de toute facon inutile : le positionnement fixe
       sort le corps du flux, `html` n'a plus de contenu, donc plus rien a faire
       defiler. C'est ce que ce controle protege -- le jour ou quelqu'un le
       remettra pour bloquer le defilement, il saura pourquoi il ne faut pas. */
    vrai(source, 'app.js doit être lisible pour ce contrôle');
    const debut = source.indexOf('function gelerFond');
    vrai(debut > 0, 'gelerFond doit être trouvable');
    const fn = source.slice(debut, source.indexOf('function degelerFond'));
    vrai(/position = 'fixed'/.test(fn),
      'le fond se gèle par le positionnement, c’est lui qui garde la place');
    vrai(!/style\.overflow/.test(fn),
      'overflow sur le corps le transforme en boîte de rognage d’une hauteur '
      + 'd’écran : la page défilée disparaît derrière la fenêtre');
  });

  test('la sortie d’une fenêtre ne dépend pas des autres fenêtres', () => {
    /* `masquerModal` eteint la fenetre 170 ms plus tard, et renonce si elle a
       rouvert entre-temps. Un compteur global aux deux fenetres de
       l'application, `#modal` et `#confirm`, ne convient pas : elles se ferment
       souvent l'une apres l'autre -- Annuler sur la saisie d'un mois ferme la
       confirmation, puis la saisie. La seconde fermeture ferait avancer le
       compteur, la sortie differee de la premiere se croirait perimee et
       rendrait la main sans rien eteindre -- `#confirm` resterait `hidden =
       false` pour le reste de la session.

       Invisible a l'ecran (`pointer-events: none`, opacite nulle), mais present
       dans l'arbre d'accessibilite : seul un controle le voit. */
    vrai(source, 'app.js doit être lisible pour ce contrôle');
    vrai(/const generationModal = new WeakMap\(\)/.test(source),
      'le compteur de génération doit être par fenêtre, pas partagé');
    vrai(/gen !== generationModal\.get\(m\)/.test(source),
      'et la sortie différée doit se comparer à la génération de SA fenêtre');
    vrai(!/\+\+generationModal\b/.test(source),
      'un compteur global ferait qu’une fenêtre qui se ferme empêche la '
      + 'précédente de s’éteindre');
  });

  test('aucun pavé de texte sur une carte', () => {
    /* Une carte montre des chiffres, le « ? » porte le pourquoi. Un paragraphe qui
       repete la premiere phrase de sa propre bulle d'aide, deux centimetres plus
       bas, n'apprend rien : trois barres n'ont pas besoin de soixante-dix mots.

       La regle se mesure : le seuil est a 35 mots par paragraphe -- un cliquet,
       pas une cible : l'objectif reste 25, et il se resserrera quand les
       derniers paragraphes longs seront traites.

       Limite assumee de ce controle : il ne compte que le texte litteral, les
       `${'$'}{...}` sont retires sans etre remplaces. Il sous-estime donc un
       paragraphe fait surtout d'interpolations -- mais il n'echoue jamais a
       tort, et il attrape celui qu'on ecrira demain a la main. */
    vrai(source, 'app.js doit être lisible pour ce contrôle');
    const blanc = m => m.replace(/[^\n]/g, ' ');
    const nu = source.replace(/\/\*[\s\S]*?\*\//g, blanc).replace(/<!--[\s\S]*?-->/g, blanc);

    /* Retirer les `${...}` en comptant les accolades : une interpolation en
       contient souvent d'autres, et une expression rationnelle simple
       s'arreterait a la premiere fermante. */
    const sansInterpolation = s => {
      let out = '', i = 0;
      while (i < s.length) {
        const j = s.indexOf('${', i);
        if (j < 0) return out + s.slice(i);
        out += s.slice(i, j);
        let k = j + 2, prof = 1;
        while (k < s.length && prof > 0) {
          if (s[k] === '{') prof++; else if (s[k] === '}') prof--;
          k++;
        }
        i = k;
      }
      return out;
    };

    const fautifs = [];
    for (const m of nu.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/g)) {
      /* Un ecran vide est exempte, et ce n'est pas un passe-droit : quand il n'y
         a aucun chiffre a montrer, le texte EST le contenu de la carte. Il dit
         quoi faire pour qu'elle se remplisse, ce qui demande des phrases. La
         classe `empty` le declare — un paragraphe qui veut en profiter doit donc
         se dire ecran vide, ce qui se relit. */
      if (/\bclass="[^"]*\bempty\b/.test(m[1])) continue;
      const texte = sansInterpolation(m[2]).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const mots = texte ? texte.split(' ').length : 0;
      if (mots > 35)
        fautifs.push(`ligne ${nu.slice(0, m.index).split('\n').length} : ${mots} mots`);
    }
    eq(fautifs.length, 0,
      'paragraphe trop long sur une carte (' + fautifs.join(', ')
      + ') — une carte montre des chiffres, le « ? » porte le pourquoi');
  });

  test('aucune fenêtre de saisie ne jette une modification en silence', () => {
    /* Trois fenetres jetaient la saisie sur « Annuler » sans un mot : la saisie
       d'un mois de depenses, et toutes celles bâties sur `askForm` — une charge
       fixe corrigee, un compte renomme, un placement revalorise.

       La question vit dans `askForm` et non chez ses appelants : il y en a une
       dizaine, et le onzieme aurait oublie de la poser. Ce controle verifie que
       les trois portes de sortie — le bouton Annuler, la croix, la touche
       Echap — passent toutes par la demande, et qu'aucune ne rappelle
       `fermer(null)` en direct. */
    vrai(source, 'app.js doit être lisible pour ce contrôle');
    const debut = source.indexOf('function askForm');
    vrai(debut > 0, 'askForm doit être trouvable');
    const fin = source.indexOf('\nfunction ', debut + 1);
    const fn = source.slice(debut, fin > 0 ? fin : debut + 6000);
    vrai(fn.includes('askConfirm'), 'la découpe doit contenir la fin de la fonction');

    for (const [porte, motif] of [
      ['le bouton Annuler', /#frmCancel'\)\.onclick = annulerOuDemander/],
      ['la croix', /#modalClose'\)\.onclick = annulerOuDemander/],
      ['la touche Échap', /Escape'\)[^\n]*annulerOuDemander/],
    ]) vrai(motif.test(fn), `${porte} doit passer par la demande de confirmation`);

    /* Et la question ne se pose que si quelque chose a change : une question qui
       revient sans raison s'apprend a fermer sans lire. */
    vrai(/JSON\.stringify\(valeurs\(\)\) === depart/.test(fn),
      'la fenêtre propre doit se fermer sans rien demander');
  });

  test('« en ajouter une autre » enchaîne, et ne s’invite pas dans une modification', () => {
    /* Depuis que le tableau des charges fixes passe par sa fenêtre, en saisir dix
       demandait dix allers-retours par « + Ligne ». Le bouton enregistre et rouvre
       une fenêtre vide.

       Trois choses à tenir, et la troisième est celle qui aurait mordu.

       Il ne s'affiche que si l'appelant le demande : une fenêtre de modification
       n'a rien à enchaîner, on ne modifie pas deux fois la même ligne.

       La boucle est chez l'appelant, parce que c'est lui qui sait quoi recalculer
       entre deux saisies — les crédits déjà rattachés changent dès que la charge
       précédente en prend un.

       Et « Enregistrer » ne doit pas enchaîner : `onclick = lire` aurait passé
       l'événement de clic en premier argument, donc un objet toujours vrai à la
       place du drapeau. Chaque validation aurait rouvert la fenêtre, sur les dix
       formulaires de l'application d'un coup. */
    vrai(source, 'app.js doit être lisible pour ce contrôle');

    vrai(/function askForm\(\{[^)]*encore = ''/.test(source),
      'askForm doit accepter le libellé du bouton, et ne rien afficher sans lui');
    vrai(/\$\('#frmOk'\)\.onclick = \(\) => lire\(\)/.test(source),
      '« Enregistrer » doit appeler lire() sans argument : lui passer l’événement '
      + 'de clic armerait l’enchaînement à chaque validation');
    vrai(/\$\('#frmEncore'\)\.onclick = \(\) => lire\(true\)/.test(source),
      'et le troisième bouton est le seul à l’armer');

    /* La ligne se derive du balisage : toute fenetre qui offre le bouton doit
       boucler sur la reponse, y compris celle que quelqu'un ajoutera demain. */
    const offres = [...source.matchAll(/encore: '/g)];
    vrai(offres.length >= 1, 'au moins une fenêtre doit offrir l’enchaînement');
    for (const m of offres) {
      const debut = source.lastIndexOf('async \'', m.index);
      vrai(debut > 0, 'chaque offre doit vivre dans une action nommée');
      const action = source.slice(debut, m.index + 3000);
      vrai(/for \(;;\)/.test(action) && /if \(!v\.__encore\) return/.test(action),
        'une fenêtre qui offre l’enchaînement doit boucler sur la réponse, sinon le '
        + 'bouton enregistre et ne rouvre rien');
    }

    /* Et la fenetre de modification ne l'offre pas. */
    const edit = source.indexOf(`async 'edit-charge'`);
    vrai(edit > 0, 'la fenêtre de modification doit être trouvable');
    vrai(!/encore:/.test(source.slice(edit, edit + 2000)),
      'modifier une charge n’enchaîne rien : il n’y a pas de deuxième ligne à créer');
  });

  test('une bulle d’aide s’ouvre aussi dans une fenêtre', () => {
    /* Trois defauts empiles empechent une bulle d'aide de fonctionner dans une
       fenetre : celle de Part du portefeuille, de Nature, de Valeur, de Date
       d'achat, toutes celles des apercus.

       1. Des ecouteurs poses element par element, dans une boucle sur
          `$$('[data-aide]')` rejouee a chaque rendu, n'atteignent que ce qui
          existe au moment du rendu de la page -- jamais le contenu d'une
          fenetre, qui nait apres. Un ecouteur delegue ne connait pas les
          elements, il connait un attribut : il attrape aussi celui qu'on
          ajoutera demain.
       2. Un panneau place avec `window.scrollY` se trompe dans une fenetre
          ouverte, qui gele le corps en `position: fixed` : le document n'a plus
          rien a faire defiler, `scrollY` retombe a zero, et la bulle irait se
          poser la ou la page etait avant le gel.
       3. A `z-index: 90`, il vivrait sous la fenetre qui est a 100 -- donc sous
          ce qu'il vient expliquer.

       Corriger un seul des trois ne donnerait rien de visible : les trois
       assertions se tiennent ensemble. */
    const css = lireSource('assets/styles.css');
    vrai(source && css, 'les deux sources doivent être lisibles');

    const debut = source.indexOf('function monteAides');
    vrai(debut > 0, 'monteAides doit être trouvable');
    /* Commentaires retires : ce controle porte sur ce que le code fait, et les
       commentaires de cette fonction nomment justement les pieges qu'elle evite.
       Sans ce nettoyage, l'assertion sur `window.scrollY` echouait sur la phrase
       qui explique pourquoi il n'y en a plus. Un test qui lit la prose d'a cote
       est un test qui lit autre chose que ce qu'il croit lire. */
    const fn = source.slice(debut, debut + 4200).replace(/\/\*[\s\S]*?\*\//g, '');

    vrai(!/for \(const btn of \$\$\(\'\[data-aide\]\'\)\)/.test(fn),
      'plus de câblage élément par élément : il ne voit pas ce qui naît après lui');
    for (const ev of ['mouseover', 'focusin', 'click', 'keydown']) {
      vrai(new RegExp(`document\\.addEventListener\\('${ev}'`).test(fn),
        `${ev} doit être délégué au document, sinon les fenêtres restent muettes`);
    }
    /* `mouseover` et `focusin`, pas `mouseenter` ni `focus` : seuls les premiers
       remontent jusqu'au document. C'est le piege exact de cette delegation. */
    vrai(!/addEventListener\('(mouseenter|focus)'/.test(fn),
      'mouseenter et focus ne remontent pas : un écouteur délégué ne les verrait jamais');
    vrai(/monteAides\.monte/.test(fn),
      'le montage se fait une fois, pas à chaque rendu : render() appelle monteAides '
      + 'à chaque passage et les écouteurs s’empileraient');
    vrai(!/window\.scrollY/.test(fn),
      'le placement ne doit plus additionner le défilement : le panneau est en '
      + 'coordonnées de fenêtre, et scrollY vaut zéro dès qu’une fenêtre gèle le fond');

    /* Et son plan passe devant la fenetre. On lit les deux valeurs plutot que
       d'en epingler une : c'est leur rapport qui compte. */
    const zDe = sel => {
      const m = css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{[^}]*z-index:\\s*(\\d+)'));
      return m ? Number(m[1]) : null;
    };
    const zAide = zDe('.aide-panneau'), zModal = zDe('.modal');
    vrai(zAide !== null && zModal !== null, 'les deux doivent déclarer leur plan');
    vrai(zAide > zModal,
      `la bulle (${zAide}) doit passer devant la fenêtre (${zModal}) : elle explique ce `
      + 'qu’il y a dedans, elle ne peut pas être dessous');
    vrai(/\.aide-panneau\s*\{[^}]*position:\s*fixed/.test(css),
      'et se placer en coordonnées de fenêtre, comme getBoundingClientRect');
  });

  test('aucun champ de saisie ne peut déclencher le zoom d’iOS', () => {
    /* « Si on zoom ça reste zoomé. » Ce n'était pas le pincement, qui se défait
       en pinçant : c'est le recadrage automatique de Safari sur un champ dont le
       texte fait moins de 16 px, et celui-là ne se défait jamais. On touche un
       montant, la page se recadre, et rien ne la remet.

       La règle qui protège existait déjà. Elle perdait — non par ordre, mais par
       **spécificité** : `select.annee` (0,1,1) et `table.editable input.derived`
       (0,2,2) contre `select` (0,0,1). Mesure à 375 px avant correction : sept
       champs sous les 16 px, dont les six sélecteurs d'année. Un habillage
       décoratif battait une garantie de comportement, et rien ne le disait.

       D'où le `!important`, qui est ici un choix et non une facilité : aucune
       taille décorative ne doit pouvoir rallumer le zoom. Tenir à la main la
       liste des exceptions aurait péri au premier habillage suivant — c'est la
       règle de la maison, une liste se dérive, elle ne se recopie pas.

       Le pincement, lui, reste possible. Le bloquer a été essayé et retiré le
       jour même : c'est l'anti-motif qu'iOS refuse depuis dix ans, et il ne
       supprimait pas ce symptôme-ci. */
    const css = lireSource('assets/styles.css');
    vrai(css, 'assets/styles.css doit être lisible pour ce contrôle');
    const nu = css.replace(/\/\*[\s\S]*?\*\//g, '');

    vrai(/input,\s*select,\s*textarea\s*\{[^}]*font-size:\s*16px\s*!important/.test(nu),
      'la garantie doit être posée sur les trois contrôles de formulaire, et en '
      + '« !important » : sans lui, une règle plus spécifique la bat en silence');

    /* Et personne ne doit pouvoir la reprendre par le meme moyen. Une seule
       regle a le droit de forcer la taille d'un champ, et c'est celle du dessus. */
    const forces = [...nu.matchAll(/([^{}]*)\{([^}]*font-size:\s*([\d.]+)px\s*!important[^}]*)\}/g)]
      .filter(m => /input|select|textarea/.test(m[1]) && Number(m[3]) < 16);
    eq(forces.length, 0,
      'aucune règle ne doit forcer un champ sous 16 px : ' + forces.map(m => m[1].trim()).join(', '));

    /* Le double-tap se refuse, le pincement non : c'est la difference entre
       corriger un accident et confisquer un geste. */
    vrai(/html\s*\{[^}]*touch-action:\s*manipulation/.test(nu),
      'le zoom au double-tap doit être neutralisé, lui qu’on déclenche sans le vouloir');
    /* Commentaires HTML retires : celui qui vit au-dessus de cette balise nomme
       `user-scalable=no` pour expliquer pourquoi il n'y est pas. Un controle doit
       lire ce que le navigateur lit, jamais la prose qui l'entoure — c'est la
       deuxieme fois de la journee que ce piege se referme. */
    const html = (lireSource('index.html') || '').replace(/<!--[\s\S]*?-->/g, '');
    vrai(!/user-scalable\s*=\s*no/.test(html),
      'et le viewport ne doit pas prétendre interdire le zoom : Safari l’ignore depuis '
      + 'iOS 10, la ligne ne ferait que mentir sur l’intention');
  });

  test('aucun octet de contrôle invisible', () => {
    /* `store.js` a déjà porté deux 0x08 là où des bornes de mot étaient
       voulues, et de vrais NUL. La regex ne reconnaissait plus « gold », et
       git classait le fichier en binaire. */
    vrai(source, 'app.js doit être lisible pour ce contrôle');
    const suspects = [...source].filter(c => {
      const n = c.charCodeAt(0);
      return n < 9 || (n > 13 && n < 32) || n === 127;
    });
    eq(suspects.length, 0,
      'octets de contrôle trouvés : ' + suspects.map(c => '0x' + c.charCodeAt(0).toString(16)).join(' '));
  });

  test('l’accueil ne trace pas deux fois la même courbe', () => {
    /* Le hero portait une sparkline du patrimoine, deux cents pixels au-dessus
       d'une carte « Évolution du patrimoine » qui trace la même série avec un
       axe, cinq plages et une infobulle. La petite ne pouvait être qu'une
       version plus faible de la grande, et deux dessins du même chiffre
       finissent par se contredire : c'est arrivé entre les cartes d'évolution
       de l'Aperçu et du Budget, à une version d'écart.

       Le hero décompose désormais le montant au lieu de le redessiner. Ce test
       garde les deux règles : aucun conteneur de sparkline dans le source, et
       une seule fabrique de courbe d'évolution, `monterEvolution()`. */
    vrai(source, 'assets/app.js doit être lisible pour ce contrôle');
    /* UNE COURBE EST REVENUE DANS LE HERO, ET LA REGLE N'A PAS CHANGE POUR
       AUTANT. Ce que ce test interdit est le DOUBLON : une petite courbe qui
       resumerait ce que la grande montre en mieux. Celle-ci est d'une autre
       nature, et la difference est structurelle plutot que cosmetique : sa
       fenêtre est celle que `variationAn()` a retenue, exactement celle du
       « +13 895 € · +7,6 % » posé à sa gauche. Elle illustre CE chiffre-là.
       La carte du dessous, elle, porte sa propre plage et son axe.
       C'est cette liaison que le test fige : si la courbe cessait de lire
       `varAn.depuis`, elle redeviendrait le doublon qu'on avait retiré. */
    eq((source.match(/Charts\.sparkline/g) || []).length, 1,
      'une seule sparkline, et une seule montee');
    vrai(/serieAn\(varAn\.depuis, evoNet\)/.test(source),
      'sa fenêtre est celle de la variation annoncée à côté, jamais une autre');
    vrai(/const pts = pointsAn\(v\.depuis, evoNet\);/.test(source),
      'et le montage lit la même');
    /* Ni axe, ni plage, ni selection de periode : une infobulle au doigt n'en
       fait pas un graphique d'historique, elle dit ce qu'on avait a ce
       moment-la sans quitter l'apercu. */
    /* La fenetre est l'APPEL, et rien d'autre : ouverte sur le mot `sparkline`,
       elle attrapait les commentaires voisins, ou « ni legende » suffisait a la
       rendre rouge. */
    const appel = source.slice(source.indexOf('Charts.sparkline('),
                               source.indexOf(';', source.indexOf('Charts.sparkline(')));
    /* `height` N'EST PLUS INTERDIT : c'est lui qui rabaisse la courbe au rang de
       support. Ce que ce contrôle garde, c'est qu'elle ne devienne pas un
       graphique — axes, plage, légende, zoom. */
    for (const interdit of ['axis', 'ticks', 'legend', 'zoom', 'range']) {
      vrai(!appel.includes(interdit), `la petite courbe ne reçoit pas ${interdit}`);
    }
    vrai(/height: 36/.test(appel), 'et sa hauteur se passe à la construction');
    /* Un seul endroit remplit le conteneur de la courbe d'évolution. Compter
       tous les `Charts.stackedArea` serait faux : la projection en appelle un
       aussi, sur une série qui n'a rien à voir. */
    eq((source.match(/#chartEvo/g) || []).length, 1,
      'une seule fabrique de courbe d’évolution, sinon deux appels divergent');
    /* Deux appels avant, un seul depuis que le journal patrimonial ne trace plus
       rien : la courbe d'evolution vit sur Aujourd'hui, et Historique n'avait
       plus de conteneur a remplir — `monterEvolution()` y sortait en silence,
       ce qui est le pire des etats, celui qui ne se signale pas. */
    eq((source.match(/monterEvolution\(\)/g) || []).length, 2,
      'sa définition et son seul appelant, l’Aperçu');
    /* La barre du hero et la liste en dessous descendent de la même source :
       une seule liste, donc les couleurs et les parts ne peuvent pas différer.

       Et depuis que cette répartition suit le commutateur Net / Brut, elles
       doivent le suivre ENSEMBLE : un appel qui oublierait l'argument ferait
       diverger la barre de la liste qu'elle résume, sur le même écran et au même
       instant. Le contrôle porte donc sur l'appel complet, argument compris. */
    eq((source.match(/repartitionClasses\(/g) || []).length, 2,
      'la barre et la liste appellent la même répartition, et rien d’autre');
    eq((source.match(/repartitionClasses\(\{ net: evoNet \}\)/g) || []).length, 2,
      'et toutes deux dans le même mode : sans l’argument, l’une compterait le '
      + 'brut pendant que l’autre compte le net');
  });

  test('aucun sous-onglet ne partage sa route avec sa vue, sauf le premier', () => {
    /* En mettant Objectifs devant Patrimoine, l'onglet Patrimoine est devenu
       inatteignable : chaque clic le renvoyait sur Objectifs. Sa route etait
       `allocation`, soit l'adresse de base de la vue, et `currentView()` ramene
       toujours l'adresse de base au premier onglet — donc a Objectifs.

       La regle qui en decoule vaut pour toutes les vues a onglets : le premier
       peut porter l'adresse de base, les suivants doivent avoir la leur. Ce test
       la verifie sur la table entiere, donc il protege aussi les reordonnancements
       de Budget, Marches et Donnees.

       Et chaque route distincte doit etre servie : sans redirection, un signet
       tomberait sur la vue d'ensemble. */
    vrai(source, 'assets/app.js doit être lisible pour ce contrôle');
    const onglets = litteral('SOUS_ONGLETS');
    const redirections = litteral('REDIRECTIONS');

    for (const [vue, liste] of Object.entries(onglets)) {
      liste.forEach(([cle, label, route], i) => {
        vrai(!!label, `${vue}.${cle} porte un libellé`);
        if (i === 0) return;
        vrai(route !== vue,
          `${vue}.${cle} porte la route « ${route} », qui est l’adresse de base de `
          + `« ${vue} » : cet onglet serait inatteignable, seul le premier peut la partager`);
        vrai(!!redirections[route],
          `la route « ${route} » doit être servie par une redirection`);
      });
      /* Les routes d'une meme vue sont distinctes, sinon deux onglets se
         disputeraient la meme adresse. */
      const routes = liste.map(o => o[2]);
      eq(new Set(routes).size, routes.length, `${vue} : deux onglets sur la même route`);
    }

    /* Le cas concret qui a casse, verifie nommement.

       Cible a quitte Allocation pour Marches : son calcul part de
       `stockTotals()` et sort l'immobilier et le non cote de sa base, donc elle
       ne pilote que le portefeuille investissable. La paire
       « Patrimoine | Cible » avait l'air d'opposer le reel au vise alors
       qu'elle comparait deux perimetres, ce que ce projet s'interdit ailleurs.

       Ce qui rend le deplacement possible est justement ce que ce test protege :
       chaque onglet porte sa propre route, donc aucun ne depend d'etre le
       premier ni de rester dans sa vue d'origine. C'est le contraire qui avait
       casse, le jour ou un onglet dont la route ETAIT l'adresse de base est
       passe en second. */
    eq(onglets.allocation[0][0], 'reel', 'Patrimoine ouvre Allocation');
    eq(onglets.allocation.length, 1, 'et Allocation n’a plus que lui');
    /* Cible est passee en deuxieme position le jour ou Performance a quitte la
       barre. L'indice suit la table plutot qu'un rang fige : c'est la derniere
       entree qu'on veut, et elle porte sa propre adresse. */
    const cible = onglets.positions[onglets.positions.length - 1];
    eq(cible[2], 'rebalance', 'Cible a sa propre adresse, dans Marchés');
    eq(onglets.positions.length, 2, 'Marchés porte deux onglets depuis que Performance est partie');
    eq(redirections.patrimoine[2], 'reel', 'l’ancienne adresse mène toujours à Patrimoine');
    eq(redirections.rebalance[0], 'positions', 'et l’ancienne adresse de Cible mène à Marchés');
    eq(redirections.rebalance[2], 'cible', 'sur son onglet');
  });

  test('une vue à un seul onglet n’affiche pas de barre', () => {
    /* Un selecteur a un seul choix n'est pas un selecteur : c'est un bouton
       enfonce qui ne mene nulle part, et il prend la hauteur d'une barre pour
       n'offrir aucune alternative. Allocation est passee a un onglet le jour ou
       Cible a rejoint Marches.

       La regle se derive de la source et non d'une liste de vues : toute page
       qui perd un onglet perd sa barre, et toute page qui en gagne un second la
       retrouve sans qu'on y pense. Ecrire « Allocation n'a pas de barre »
       aurait fige le cas du jour au lieu de la regle. */
    vrai(source, 'assets/app.js doit être lisible pour ce contrôle');
    const corps = source.slice(source.indexOf('function barreSousOnglets'),
                               source.indexOf('function barreSousOnglets') + 1400);
    vrai(/choix\.length < 2\)\s*return ''/.test(corps),
      'barreSousOnglets doit s’effacer sous deux onglets : une vue à un seul '
      + 'onglet afficherait un sélecteur qui ne sélectionne rien');
    const onglets = litteral('SOUS_ONGLETS');
    const seules = Object.entries(onglets).filter(([, l]) => l.length < 2).map(([v]) => v);
    vrai(seules.includes('allocation'),
      'Allocation n’a qu’un onglet depuis que Cible est parti : si ce n’est plus '
      + 'vrai, ce test a perdu son sujet');
  });

  test('l’onglet qui s’ouvre est le premier de sa liste', () => {
    /* `sousOngletActif` portait ses valeurs en dur, a trois lignes de la table
       qui declare l'ordre des onglets. Mettre Objectifs devant Patrimoine a bien
       change l'ordre affiche, mais l'atterrissage est reste sur Patrimoine :
       deux listes ecrites a la main, et celle-ci disait le contraire de l'autre.

       Le controle lit la source : la valeur de depart doit se deriver de
       SOUS_ONGLETS, jamais se recopier. Une egalite verifiee a l'execution ne
       suffirait pas — elle passerait aussi avec deux listes qui se trouvent
       d'accord aujourd'hui, et c'est precisement ce qui a echoue. */
    vrai(source, 'assets/app.js doit être lisible pour ce contrôle');
    const decl = source.match(/const sousOngletActif =([\s\S]{0,220}?);/);
    vrai(decl, 'la déclaration de sousOngletActif doit être trouvable');
    vrai(/SOUS_ONGLETS/.test(decl[1]),
      'la valeur de départ doit se dériver de SOUS_ONGLETS, pas se recopier à côté');
    vrai(!/'reel'|'portefeuille'|'donnees'|'depenses'/.test(decl[1]),
      'aucun nom d’onglet en dur : l’ordre de la table doit décider seul');
  });

  test('personne ne juge un mois en deux couleurs', () => {
    /* Le verdict sur un mois s'affiche a six endroits : les barres du Budget, le
       tableau large, la liste sur telephone, le depliant « Voir les donnees », la
       jauge de la carte budget de l'accueil, et le total de la fenetre de saisie.
       Quatre gardaient le jugement binaire apres que le graphique soit passe a
       trois niveaux : le meme mois etait rouge sur l'accueil et orange trois
       ecrans plus loin.

       Le controle lit la source, faute de mieux : un ternaire qui choisit entre
       « down » et « up » est exactement le motif qui divergeait, et il ne doit
       plus en rester un seul. */
    vrai(source, 'assets/app.js doit être lisible pour ce contrôle');
    eq((source.match(/\?\s*'down'\s*:\s*'up'/g) || []).length, 0,
      'un jugement binaire sur l’objectif subsiste : passer par classeDepassement()');
    /* Et le passage unique est emprunte, pas seulement disponible. */
    vrai((source.match(/classeDepassement\(/g) || []).length >= 5,
      'les vues qui jugent un mois doivent toutes appeler classeDepassement()');
  });

  test('aucun geste ne dispute le défilement de la page', () => {
    /* Le geste « repousser la page pour revenir a l'accueil » est parti, et avec
       lui la derniere liste d'exclusions ecrite a la main de cette application :
       champs de saisie, tableaux defilants, ruban de reperes, lignes de compte,
       listes mobiles. Il fallait l'etendre a chaque nouveau composant qui defile
       ou qui glisse, et le prochain aurait vu son geste vole en silence.

       Il s'armait au sommet de la page, quand `scrollY` valait zero — exactement
       la condition ambigue qui a coute quatre tentatives sur la feuille des
       fiches. Un geste qui ne fait gagner aucun geste, Apercu etant le premier
       onglet de la barre du bas, ne valait pas ce risque.

       Ce test garde la porte fermee : il ne reste qu'un ecouteur tactile de
       navigation, celui du tiroir, et plus aucune liste d'exclusions. */
    vrai(source, 'assets/app.js doit être lisible pour ce contrôle');
    eq((source.match(/GLISSE_LATERAL/g) || []).length, 0,
      'la liste d’exclusions du geste de retour ne doit pas revenir');
    eq((source.match(/monteRetourAccueil/g) || []).length, 0,
      'ni le geste lui-même');
    eq((source.match(/accueil-dessous/g) || []).length, 0,
      'ni son calque de profondeur');
    /* Le CSS doit avoir suivi : une regle orpheline dessinerait une poignee qui
       n'annonce plus rien. */
    const css = lire('assets/styles.css');
    vrai(css, 'assets/styles.css doit être lisible');
    eq((css.match(/body\.repousse/g) || []).length, 0,
      'et les règles de la page-carte sont parties avec');
  });

  test('un compte change de type, sauf si ça laisse un placement sans place', () => {
    /* Le type n'etait pas modifiable, et la seule issue apres une faute de frappe
       etait de supprimer puis recreer. Les releves mensuels etant indexes par
       identifiant de compte, recreer perd l'historique : l'absence de ce reglage
       ne protegeait rien, elle poussait vers un contournement destructeur.

       Elle n'etait pas gratuite pour autant. Le type commande les classes qu'un
       compte peut porter, et passer un compte-titres en livret laisserait un
       Livret A detenant des actions — aucun ecran ne s'en plaindrait, ils
       compteraient simplement des actions dans les liquidites. */
    Fixture.poser();
    const cash = c => ({ id: 'x', type: c, cash: [{ montant: 500, affectation: 'courant' }], lignes: [] });

    /* Entre types de meme forme, rien ne s'y oppose. */
    vrai(changementDeTypePossible(cash('courant'), 'livret').ok,
      'un compte courant devient un livret : les deux ne portent que des espèces');
    vrai(changementDeTypePossible(cash('livret'), 'courant').ok, 'et réciproquement');
    vrai(changementDeTypePossible(cash('courant'), 'cto').ok,
      'un compte-titres accepte aussi des espèces');

    /* Vers un type qui ne porte pas d'especes, refus motive. */
    const versImmo = changementDeTypePossible(cash('courant'), 'immo');
    vrai(!versImmo.ok, 'un immobilier ne porte pas d’espèces');
    vrai(/espèces/.test(versImmo.raison), 'et la raison dit pourquoi');

    /* Un compte porteur de titres ne peut pas devenir un livret. C'est le cas
       qui justifie toute la regle. */
    const pea = Store.state.comptes.find(c => typeCompte(c.type).titres
      && lignesDe(c).some(l => l.classe === 'actions'));
    vrai(pea, 'le fixture porte un compte de titres');
    const versLivret = changementDeTypePossible(pea, 'livret');
    vrai(!versLivret.ok, 'un livret ne peut pas détenir des actions');
    vrai(/Déplace/.test(versLivret.raison),
      'et la raison dit quoi faire, pas seulement que c’est refusé');

    /* Le meme compte vers un type qui accepte les actions : possible. */
    /* Une assurance-vie accepte les actions, pas les especes : le PEA du
       fixture en porte, elles se remettent a zero d'abord. */
    vrai(!changementDeTypePossible(pea, 'av').ok, 'les espèces du PEA n’entrent pas dans un contrat');
    vrai(changementDeTypePossible({ ...pea, cash: [] }, 'av').ok,
      'une assurance-vie accepte les actions, le changement passe');

    /* Cas limites : type inconnu, meme type, compte absent. */
    vrai(!changementDeTypePossible(cash('courant'), 'nawak').ok, 'un type inconnu se refuse');
    vrai(!changementDeTypePossible(null, 'livret').ok, 'un compte absent aussi');
    const sur = changementDeTypePossible(cash('courant'), 'courant');
    vrai(sur.ok && sur.sansChangement, 'le même type ne change rien et ne se plaint pas');

    /* Une poche a zero ne bloque pas : elle ne porte rien. */
    vrai(changementDeTypePossible(
      { id: 'x', type: 'courant', cash: [{ montant: 0, affectation: 'courant' }], lignes: [] },
      'immo').ok, 'une part à zéro n’empêche rien');
  });

  test('la couleur d’un groupe de comptes ne s’invente pas', () => {
    /* Elle etait un hachage du nom du groupe vers les huit teintes de serie.
       « t-courant » et « t-cto » tombaient tous deux sur `series-6` — deux groupes
       de la meme couleur dans la meme liste, ce que la couleur devait justement
       eviter. Et le hachage piochait dans un vocabulaire qui veut dire autre
       chose : `series-1` est le bleu des liquidites, `series-2` le vert des actifs
       de marche : un etablissement de banque heritait donc du vert des actifs
       de marche.

       C'est pire qu'une absence de couleur : un faux signal dans une langue que
       le reste de l'application tient juste, et que le test « un actif porte la
       meme couleur partout » protege. Sur Comptes, une couleur veut desormais dire
       une classe d'actif, ou rien. */
    const bloc = source.slice(source.indexOf('function teinteGroupe'),
                              source.indexOf('function teinteGroupe') + 400);
    vrai(!/charCodeAt/.test(bloc),
      'la teinte d’un groupe ne se calcule plus depuis son nom');
    /* Elle ne prend plus d'argument : elle ne peut donc plus dependre de
       l'identite du groupe, ce qui est la garantie qu'on cherche. Une assertion
       plus large — aucune teinte de serie choisie par un index — attrapait
       `teinterParRang`, qui est legitime : la, la couleur vient du rang dans une
       seule liste, attribuee en un seul endroit pour le tableau et le camembert,
       donc toujours d'accord avec elle-meme et sans collision possible. */
    vrai(/function teinteGroupe\(\)/.test(bloc),
      'et elle ne reçoit plus rien dont elle pourrait la tirer');
    /* Et chaque groupe garde une vraie couleur, tiree de ce qu'il contient.

       L'assertion porte sur le mecanisme qui tient l'invariant, et non sur un
       onglet de la page Actifs qui n'existe plus : `teinteDominante()` prend la
       classe majoritaire du contenu. Un courtier plein de titres se lit vert, un
       livret bleu, et jamais l'inverse. */
    vrai(/teinteDominante\(/.test(source),
      'chaque groupe reçoit la couleur de ce qu’il contient');
    /* Les trois groupes de la page Actifs — un établissement, le hors-contenant,
       une enveloppe — plus les deux en-têtes de fiche. Le compte est fait sur les
       appels réels et non sur les mentions : deux commentaires la nomment. */
    const appels = source.slice(source.indexOf('function viewAccounts'),
                                source.indexOf('function mountAccounts'));
    /* Deux portes desormais, et chacune a sa raison : un ETABLISSEMENT prend la
       couleur de sa famille, un groupe qui EST une classe d'actif prend celle de
       la classe. Le compte porte sur les deux reunies — aucun groupe ne se peint
       autrement, et c'est ca qu'on verifie. */
    const parClasse = (appels.match(/teinteDominante\(/g) || []).length;
    const parFamille = (appels.match(/teinteEtab\(/g) || []).length;
    eq(parClasse + parFamille, 3,
      'les trois groupes de la page passent par l’une des deux : aucun ne se '
      + 'peint autrement');
    eq(parFamille, 1, 'un seul groupe est un établissement');
  });

  test('le reste à verser sur un livret plafonné', () => {
    /* Un Livret A s'arrete a 22 950 EUR. Le plafond est saisi et non deduit du
       type : le modele connait « livret », pas le produit, et une table des
       plafonds par produit aurait demande d'etre tenue a jour a chaque
       revalorisation reglementaire.

       Le cas qui compte est le depassement. Un livret peut passer son plafond
       par le seul jeu des interets, c'est legal, et « il reste −40 EUR a verser »
       serait une facon absurde de dire qu'il est plein. */
    const livret = m => ({ id: 'l', type: 'livret', cash: [{ montant: m, affectation: 'precaution' }] });

    eq(resteAVerser(livret(5000)), null,
      'sans plafond déclaré, il n’y a rien à dire');
    eq(resteAVerser({ ...livret(5000), plafond: 0 }), null,
      'un plafond à zéro vaut absence de plafond, pas un livret plein');

    const p = resteAVerser({ ...livret(10000), plafond: 22950 });
    pres(p.reste, 12950, 'il reste le plafond moins ce qui est versé');
    pres(p.verse + p.reste, p.plafond, 'et les deux font le plafond, sans reste');
    pres(p.part, 10000 / 22950 * 100, 'la part remplie suit le même rapport');
    vrai(!p.plein, 'à 10 000 sur 22 950, le livret n’est pas plein');

    /* Le depassement, par les interets. */
    const d = resteAVerser({ ...livret(23100), plafond: 22950 });
    pres(d.reste, 0, 'un dépassement ne donne pas un reste négatif');
    pres(d.part, 100, 'et la jauge ne dépasse pas sa boîte');
    vrai(d.plein, 'le livret est annoncé plein');

    /* Pile au plafond : plein, et rien a verser. */
    const e = resteAVerser({ ...livret(22950), plafond: 22950 });
    pres(e.reste, 0, 'pile au plafond, il ne reste rien');
    vrai(e.plein, 'et il est plein');

    /* Plusieurs poches sur le meme livret : c'est leur somme qui compte, un
       plafond porte sur le compte et non sur un usage. */
    const deux = resteAVerser({ id: 'l', type: 'livret', plafond: 22950,
      cash: [{ montant: 8000, affectation: 'precaution' }, { montant: 2000, affectation: 'projet' }] });
    pres(deux.verse, 10000, 'les poches d’un même livret s’additionnent');
    pres(deux.reste, 12950, 'et le reste se calcule sur leur somme');
  });

  test('la date d’ouverture reste atteignable partout où elle existe', () => {
    /* Elle ne compte que pour trois types de compte : un PEA se debloque a cinq
       ans, une assurance-vie a huit, un PER a la retraite. Le modele porte le
       drapeau qui le dit, et la fiche s'en sert pour ne pas donner la meilleure
       place de la carte a une date que personne ne relit sur un compte courant.

       Le risque de ce genre de tri est d'enterrer la donnee : quelqu'un qui a
       saisi une date sur un livret doit pouvoir la corriger ou l'effacer, et un
       champ qu'on ne peut plus atteindre est une donnee perdue.

       La date ne se saisit pas dans la page : elle s'y lit, et se corrige par
       Modifier. Le test regarde donc les deux moities : ce que la fiche montre,
       et ce que le formulaire propose. */
    const fiche = source.slice(source.indexOf('function viewFicheCompte'),
                               source.indexOf('function viewFicheEtab'));
    vrai(fiche.length > 1000, 'la fiche de compte doit être trouvable');

    /* Ce qui se lit. Sur un type ou l'anciennete debloque quelque chose, la
       ligne reste meme vide : son absence est un manque, pas un silence. */
    vrai(!/comptes\.\$\{idx\}\.ouvertLe/.test(fiche),
      'la date ne se saisit plus dans la page : elle est passée derrière « Modifier »');
    /* Deux lignes de date : celle qui reclame sur un type sensible, celle qui
       constate ailleurs quand la date existe. La seconde ne porte plus le mot en
       dur — une Rolex n'a pas de date d'ouverture, elle a une date d'achat — et
       le tire de `motDateCompte()`, qui vit cote store avec le predicat. */
    eq((fiche.match(/Date d’ouverture/g) || []).length, 1,
      'la ligne des types sensibles garde le mot : un PEA s’ouvre');
    vrai(/motDateCompte\(t\)/.test(fiche),
      'l’autre ligne dérive son intitulé du type au lieu de le recopier');
    eq(motDateCompte(typeCompte('bienValeur')), 'Date d’achat',
      'un bien de valeur s’achète');
    eq(motDateCompte(typeCompte('immo')), 'Date d’achat', 'un bien immobilier aussi');
    eq(motDateCompte(typeCompte('courant')), 'Date d’ouverture', 'un compte s’ouvre');
    eq(motDateCompte(typeCompte('pea')), 'Date d’ouverture', 'un PEA aussi');
    vrai(/à renseigner/.test(fiche),
      'un type sensible sans date le dit, au lieu de masquer la ligne');
    vrai(/t\.dateSensible \? `/.test(fiche),
      'la branche visible se décide sur le drapeau du modèle');

    /* Ce qui se corrige. Le formulaire propose la date a tout compte qui n'est
       pas les especes, y compris ceux ou elle ne sert a rien : c'est la seule
       facon d'effacer une date posee par erreur sur un livret. */
    const debut = source.indexOf("async 'modifier-compte'");
    vrai(debut > 0, 'l’action modifier-compte doit exister');
    /* Bornee a l'action suivante, pas a un nombre de caracteres : un
       commentaire ajoute dans la fenetre la faisait sortir de la tranche. */
    const handler = source.slice(debut, source.indexOf("async 'ajouter-compte'", debut));
    vrai(handler.includes("cle: 'ouvertLe'"),
      'le formulaire de modification doit porter la date d’ouverture');
    vrai(/label: motDateCompte\(/.test(handler),
      'et l’intitulé du formulaire suit le même mot que la fiche');
    vrai(!/dateSensible[^\n]*champs\.push/.test(handler),
      'le champ ne doit pas être réservé aux types sensibles : une date posée par '
      + 'erreur ailleurs deviendrait ineffaçable');

    /* Le drapeau existe, et sur les deux types attendus. Une vue qui recopierait
       la liste des types finirait par ne plus decrire le modele. Le PER n'y est
       pas : il se libere a un evenement, et sa date de deblocage se declare. */
    const sensibles = TYPES_COMPTE.filter(t => t.dateSensible).map(t => t.id).sort();
    eq(sensibles.join(','), 'av,pea',
      'PEA et assurance-vie sont les deux types dont l’ancienneté compte');
    for (const t of TYPES_COMPTE.filter(t => !t.dateSensible)) {
      vrai(!t.dateSensible, `${t.id} n’a pas d’âge qui débloque quoi que ce soit`);
    }
  });

  test('le premier lancement passe la graine par la migration', () => {
    /* Le pendant du controle d'execution : celui-la verifie que `load()` appelle
       bien la migration sur la branche de la graine, ce qu'aucun test
       d'execution ne peut voir sans toucher au stockage.

       La branche relue l'appelait, la branche graine non. Un etat a moitie
       construit en sortait, avec un patrimoine a zero, et cela ne se voyait qu'a
       la premiere visite — donc jamais en developpement. */
    const storeSrc = lireSource('assets/store.js');
    vrai(storeSrc, 'assets/store.js doit être lisible pour ce contrôle');
    /* La borne est la fin de la methode, pas la methode suivante : entre
       `load()` et `save()` vivent `migrate()` et ses dix sous-migrations, soit
       19 000 caracteres ou le motif cherche se trouve forcement. La tranche
       aurait passe quoi qu'il arrive. */
    const debutLoad = storeSrc.indexOf('  load() {');
    const load = storeSrc.slice(debutLoad, storeSrc.indexOf('\n  },', debutLoad));
    vrai(load.length > 200 && load.length < 2000,
      'la tranche lue doit être load() seule, pas la moitié du fichier');
    const branche = load.slice(load.indexOf('structuredClone(SEED)'));
    vrai(/this\.migrate\(\)/.test(branche),
      'la branche qui pose la graine doit appeler migrate(), comme celle qui relit');
  });

  test('le « ? » d’une aide n’est pas un bouton', () => {
    /* Un `<label>` sans `for` designe le premier element etiquetable qu'il
       contient, et un `<button>` en est un : le navigateur renvoyait donc au
       « ? » tout clic tombe sur l'intitule, et lui donnait le focus a la place
       du champ. La bulle s'ouvrait sur toute la ligne. Treize intitules portent
       un « ? » a l'interieur de leur label — le defaut valait pour les treize.

       Un span n'est pas etiquetable, mais il ne repond pas au clavier tout
       seul : les deux moities de la correction doivent tenir ensemble. */
    const src = lireSource('assets/app.js');
    vrai(src, 'assets/app.js doit être lisible pour ce contrôle');
    const m = src.match(/function aide\(texte\) \{[\s\S]*?\n\}/);
    vrai(m, 'aide() doit être trouvable dans la source');
    /* Le gabarit rendu, et lui seul, à partir du `return` : le commentaire qui
       explique la correction cite « <button> » deux fois et porte lui-même des
       accents graves. Un contrôle qui lit tout le corps se déclenchait sur son
       propre exposé des motifs, puis lisait un morceau de commentaire en croyant
       lire le gabarit. Les deux erreurs ont eu lieu, dans cet ordre. */
    const rendu = m[0].slice(m[0].indexOf('return')).match(/`[\s\S]*?`/);
    vrai(rendu, 'aide() doit rendre un gabarit');
    vrai(!/<button/.test(rendu[0]),
      'aide() ne doit pas rendre un <button> : un label le revendiquerait');
    vrai(/role="button"/.test(rendu[0]) && /tabindex="0"/.test(rendu[0]),
      'mais le « ? » garde son rôle et son entrée au clavier');
    vrai(/onkeydown/.test(src),
      'et monteAides doit écouter Entrée : un span ne convertit pas la touche en clic');

    /* Le compte des intitules concernes, pour que ce controle dise de quoi il
       parle : s'il tombe a zero, c'est que le motif a change de forme. */
    const labels = (src.match(/<label[^>]*>[^<]*\$\{aide\(/g) || []).length
                 + (src.match(/<label>\$\{esc\([^)]*\)\}\$\{aide/g) || []).length;
    vrai(labels > 5, 'plusieurs intitulés portent un « ? » : ' + labels);
  });

  test('les écouteurs des info-bulles ne se posent qu’une fois', () => {
    /* `monteAides` tourne a chaque rendu. Ses ecouteurs de document doivent donc
       etre gardes : sans cela, une session de cinquante rendus en empile
       cinquante fois autant, qui font tous le meme travail et qu'aucun ne retire.
       La fuite ne se voit pas — le comportement reste juste — jusqu'a ce que la
       page rame.

       Le garde protegeait un seul ecouteur, celui qui referme au premier appui
       ailleurs. Depuis que tous les autres sont delegues eux aussi, il protege la
       fonction entiere, et c'est bien plus qu'avant qu'il faut empecher
       d'empiler. */
    const bloc = source.slice(source.indexOf('function monteAides'),
                              source.indexOf('function yearControl'));
    vrai(bloc.length > 300, 'monteAides doit être trouvable');
    const globaux = bloc.match(/document\.addEventListener/g) || [];
    vrai(globaux.length >= 6, 'les écouteurs du panneau vivent tous sur le document');
    vrai(/if \(monteAides\.monte\) return;\s*\n\s*monteAides\.monte = true;/.test(bloc),
      'et la fonction entière doit sortir au deuxième appel, pas à chaque rendu');
  });

  test('l’objectif de dépenses ne se règle qu’à un seul endroit', () => {
    /* Il a porte deux champs a la fois, un par onglet du budget, tous deux
       branches sur `budget.monthlyTarget`. L'argument etait qu'ils ne sont jamais
       visibles en meme temps — ce qui disait surtout que personne ne pouvait
       verifier qu'ils s'accordaient. C'est le motif que ce projet defait sans
       cesse : deux ecritures d'une meme chose, qui finissent par diverger.

       Elles ne pouvaient pas diverger ici, les deux pointant le meme chemin. Le
       cout etait ailleurs : deux endroits a trouver, et deux a corriger le jour
       ou la regle change. Le reglage passe par une fenetre, appelee depuis le
       montant qui l'affiche.

       Le controle compte les champs de saisie branches sur ce chemin. La fenetre
       n'en pose pas : `askForm` construit ses champs par identifiant, sans
       `data-path`. */
    const champs = source.match(/data-path="budget\.monthlyTarget"/g) || [];
    eq(champs.length, 0,
      'aucun champ en dur ne doit écrire l’objectif : la fenêtre s’en charge');
    vrai(/'regler-objectif-depenses'/.test(source),
      'et l’action qui ouvre cette fenêtre doit exister');
    vrai(/data-action="regler-objectif-depenses"/.test(source),
      'avec un montant cliquable qui l’appelle');
  });

  test('le geste de fermeture confisque ce qu’il prend', () => {
    /* Une feuille dont le contenu tient en entier — « Depenses 2026 » mesure
       481 px dans 481 px — n'avait aucun geste : la fermeture ne partait que de
       l'en-tete, et le doigt pose dans le contenu allait faire glisser la page
       derriere, qu'on voyait bouger sous la feuille.

       Trois choses etaient fausses ensemble, et il fallait les trois pour que ca
       marche. `body { overflow: hidden }` ne verrouille pas iOS, qui laisse le
       document rebondir. `overscroll-behavior: contain` sur le corps ne
       s'applique que s'il defile vraiment, ce qui etait faux dans ce cas precis.
       Et l'ecouteur `touchmove` etait passif, donc incapable d'appeler
       `preventDefault` : le navigateur gardait la main quoi qu'on fasse.

       Ce que ce controle protege, c'est le dernier point — le seul ecouteur non
       passif du fichier, qu'un nettoyage bien intentionne remettrait volontiers
       en passif pour la performance. Il n'y a pas de performance a gagner : un
       geste de defilement rend la main avant meme d'etre qualifie. */
    const geste = source.slice(source.indexOf('function monteGlissementFermeture'),
                               source.indexOf('function monteVideChamp'));
    vrai(geste.length > 500, 'le geste de fermeture doit être trouvable');
    vrai(/touchmove[\s\S]*?\{\s*passive:\s*false\s*\}/.test(geste),
      'le touchmove du panneau doit rester non passif, sinon la page derrière glisse');
    vrai(/preventDefault\(\)/.test(geste),
      'et il doit confisquer le geste qu’il prend');

    /* Et la condition d'armement : « le corps ne peut pas defiler », non « le
       corps est en haut de son defilement ». La seconde a coute quatre
       tentatives, parce qu'une fiche longue s'ouvre toujours en haut : elle y
       rendait l'ambiguite permanente au lieu d'exceptionnelle. */
    vrai(/scrollHeight\s*-\s*\w+\.clientHeight/.test(geste),
      'l’armement se décide sur la capacité à défiler');
    vrai(!/scrollTop\s*===?\s*0/.test(geste),
      'jamais sur scrollTop === 0 : une fiche longue s’ouvre toujours en haut');
  });

  test('la barre du bas et le menu suivent le même ordre', () => {
    /* Deux navigations pour une seule application, dans deux ordres : la barre
       disait Aperçu, Marchés, Budget, Allocation quand le menu disait Aperçu,
       Budget, Marchés, Allocation. La mémoire de la position ne servait alors
       qu'à moitié, selon l'écran sur lequel on se trouvait.

       Le test lit le HTML : l'ordre des entrées de la barre doit être celui de
       leurs homologues dans le menu latéral. Il ne compare que les destinations
       communes — le menu en porte deux de plus, Comptes et Données, qui vivent
       dans les réglages. */
    const html = lire('index.html');
    vrai(html, 'index.html doit être lisible pour ce contrôle');
    const vues = bloc => [...bloc.matchAll(/data-view="([a-z]+)"/g)].map(m => m[1]);
    const menu = vues(html.slice(html.indexOf('<nav class="nav"'), html.indexOf('</nav>')));
    const barre = vues(html.slice(html.indexOf('<nav class="tabbar"')));
    vrai(barre.length >= 4, 'la barre du bas porte ses destinations');
    eq(barre.join(' '), menu.filter(v => barre.includes(v)).join(' '),
      'la barre du bas doit suivre l’ordre du menu latéral');

    /* La barre du bas est une pilule flottante, et ce qui compte est autant ce
       qu'elle porte que ce qu'elle ne porte pas.

       Une barre pleine largeur qui touche le bord supprimerait la bande morte
       qu'un iPhone peut montrer sous la pilule, mais en etalant son flou d'un
       bord a l'autre : tout le bas de l'ecran paraitrait flou, au lieu du seul
       ovale du menu. La bande morte ne vient pas de la pilule : elle vient d'une
       jupe, une couleur de page peinte sous elle, qui masque le contenu au lieu
       de le laisser defiler. Le reste de l'ecran doit rester limpide, et on doit
       voir la page defiler derriere.

       D'ou les trois assertions : la pilule est detachee des bords, la zone de
       gestes la souleve au lieu de la gonfler, et RIEN n'est peint sous elle.
       La derniere est celle qui attrape la jupe. */
    /* Les commentaires sont retires avant de chercher : celui qui explique
       pourquoi la barre n'a pas d'`overflow: hidden` nomme forcement la
       propriete qu'on interdit, et le test se serait declenche sur sa propre
       explication. */
    const css = (lireSource('assets/styles.css') || '').replace(/\/\*[\s\S]*?\*\//g, '');
    vrai(css, 'assets/styles.css doit être lisible pour ce contrôle');
    /* `lastIndexOf` et non `indexOf` : le fichier ouvre sur
       `.burger, .nav-backdrop, .tabbar { display: none; }`, et partir de la
       prenait tout le CSS dans la tranche — ou n'importe quel `overflow: hidden`
       se trouve, ce qui faisait echouer le controle pour une regle etrangere.
       La longueur est bornee pour que ce piege ne revienne pas en silence. */
    const debut = css.lastIndexOf('.tabbar {');
    const regleTabbar = css.slice(debut, css.indexOf('}', debut) + 1);
    /* La borne existe pour attraper une tranche qui aurait mangé la moitié du
       fichier, pas pour limiter la règle : le verre l'a rallongée de trois
       déclarations. Elle reste très en dessous de la taille du bloc suivant. */
    vrai(regleTabbar.length < 1400,
      'la tranche lue doit être la seule règle .tabbar, pas la moitié du fichier');
    /* Le jeton et non 999px en toutes lettres : l'intention du controle est
       que c'est une pilule, et l'echelle des rayons est fermee. */
    vrai(/border-radius:\s*var\(--radius-pill\)/.test(regleTabbar),
      'la barre du bas est un ovale : c’est lui qui porte le fond et le flou, et '
      + 'lui seul');
    vrai(/left:\s*[1-9]/.test(regleTabbar) && /right:\s*[1-9]/.test(regleTabbar),
      'et elle est détachée des bords latéraux, sinon l’ovale n’a plus de côtés');
    const ecart = regleTabbar.match(/bottom:\s*([^;]+);/);
    vrai(ecart, 'la règle doit dire à quelle hauteur la pilule flotte');
    vrai(/var\(--zone-geste\)/.test(ecart[1]) && /[1-9]\d*px/.test(ecart[1]),
      'la zone de gestes la soulève du bord par son bottom : en remplissage elle '
      + 'gonflerait la hauteur de la barre, et le fond couvrirait de nouveau le bas '
      + 'de l’écran');
    /* Le plancher protège le cas qu'on ne voit pas en développant sur un
       téléphone à encoche : `env(safe-area-inset-bottom)` vaut zéro sur un
       iPhone SE, sur la plupart des Android et dans toute fenêtre où le système
       ne réserve rien. Sans `max()`, l'écart de dessin y devient l'écart total,
       et la pilule se colle au bord physique. */
    vrai(/max\(/.test(ecart[1]),
      'et un plancher doit tenir quand la zone de gestes vaut zéro, sinon la '
      + 'pilule colle au bord sur tout appareil qui ne réserve rien');
    vrai(!/padding-bottom/.test(regleTabbar),
      'donc pas de padding-bottom sur la barre : c’est ce qui étendait son fond '
      + 'jusqu’au bord bas');

    /* Le verre et l'ombre du texte tiennent ensemble, et c'est le lien qu'on
       oublie. Le fond de la barre est à 14 % : ce qui garde « Allocation »
       lisible quand un aplat clair du graphique passe dessous, ce n'est plus le
       fond, c'est l'ombre portée des libellés et des traits d'icônes. La retirer
       ne casserait rien de visible en développement — sur un thème sombre, une
       ombre sombre ne se voit pas — et rendrait la barre illisible sur les seules
       pages qui ont des couleurs claires derrière. */
    const opacite = regleTabbar.match(/var\(--surface-1\)\s*(\d+)%/);
    vrai(opacite, 'le fond de la barre doit se lire dans sa règle');
    const lien = css.indexOf('.tabbar a, .tabbar button');
    const regleLien = css.slice(lien, css.indexOf('}', lien) + 1);
    vrai(/text-shadow:/.test(regleLien),
      `le fond de la barre est à ${opacite[1]} % : sans ombre portée sur les `
      + 'libellés, un aplat clair passant dessous les mange');

    /* La variable vit hors de toute requête média. Déclarée sous un point de
       rupture, elle ne vaudrait rien pour les règles écrites sous un autre, et
       `calc(78px + var(--zone-geste))` retomberait silencieusement à rien. */
    const decl = css.indexOf('--zone-geste:');
    vrai(decl > 0, '--zone-geste doit être déclarée');
    vrai(decl < css.indexOf('@media'),
      '--zone-geste doit être déclarée avant la première requête média, donc '
      + 'globalement : une variable sous un point de rupture ne vaut rien ailleurs');

    /* Rien ne peint sous la pilule. La jupe le faisait : un pseudo-élément de
       200 px, opaque, à `top: 100%`. Elle prétendait couvrir le trou qu'un
       décalage de la fenêtre visible découvre sous un élément fixe — clavier qui
       se referme, barre d'outils qui se replie — mais `html, body` portent déjà
       `background: var(--page)`, donc le canvas est peint et rien ne peut virer
       au noir. Son seul effet visible était de masquer le contenu qui devrait
       défiler jusqu'au bord. */
    vrai(!/\.tabbar::after/.test(css),
      'aucune jupe sous la barre : un pseudo-élément opaque posé sous une pilule '
      + 'flottante masque le contenu qui doit défiler jusqu’au bord bas');
    vrai(/html,\s*body\s*\{[^}]*background:\s*var\(--page\)/.test(css),
      'et c’est le fond de la page qui rend cette jupe inutile : sans lui, la '
      + 'bande découverte par un décalage de la fenêtre visible virerait au noir');

    /* Le seuil de la barre du bas est celui de la barre laterale, et rien
       d'autre. Il a valu 767 px quand la laterale ne redevient une colonne qu'a
       900 : entre les deux — l'iPad en portrait — l'ecran n'avait ni menu en bas
       ni menu a gauche, et la navigation ne tenait qu'au bouton de profil. Une
       mise en page et le mobilier qui la sert basculent au meme seuil. */
    const posBarre = css.lastIndexOf('.tabbar {');
    let seuil = null;
    for (const m of css.matchAll(/@media \(max-width:\s*(\d+)px\)/g)) {
      if (m.index < posBarre) seuil = m[1]; else break;
    }
    vrai(seuil, 'la barre du bas doit vivre sous une requête média de largeur');
    eq(seuil, '900',
      'la barre du bas s’affiche jusqu’au seuil où la barre latérale revient, '
      + '900 px : sinon il existe une largeur sans aucun menu');

    /* Aucune entree de menu ne doit mener a un ecran qu'une autre atteint deja.
       Les vues devenues sous-onglets — performance, rebalance, settings,
       objective — ont toutes quitte ce menu quand elles ont ete absorbees : deux
       chemins vers le meme ecran font douter qu'ils aillent au meme endroit. */
    const absorbees = Object.keys(litteral('REDIRECTIONS'));
    for (const vue of menu) {
      vrai(!absorbees.includes(vue),
        `« ${vue} » est un sous-onglet : son entrée de menu doublonne avec celle `
        + `de la vue qui l’a absorbée`);
    }
  });

  test('les pictogrammes du menu restent allumés sur téléphone', () => {
    /* Les sept icones du menu etaient dans le HTML, dimensionnees par une regle
       mobile, puis eteintes par une seconde regle du meme bloc : meme
       specificite, ecrite apres, donc c'est elle qui gagnait. Le tiroir « Plus »
       montrait des intitules nus a cote d'une gouttiere vide, pendant que le
       menu de bureau et la barre du bas portaient les memes dessins.

       Invisible a l'inspection du DOM — les <svg> sont bien la — et invisible
       aux tests de calcul. Il faut lire la feuille de style. */
    const css = lire('assets/styles.css');
    vrai(css, 'assets/styles.css doit être lisible pour ce contrôle');
    const eteint = /\.nav\s+a\s+\.ic\s*\{[^}]*display:\s*none/.test(css);
    vrai(!eteint, 'une règle éteint les icônes du menu : elles doivent rester visibles');
    vrai(/\.nav\s+a\s+svg\.ic\s*\{[^}]*(width|height)/.test(css),
      'et elles gardent une taille explicite, sinon un SVG sans dimension s’étale');
  });

  test('aucun tiret cadratin dans le texte affiché', () => {
    /* Règle d'écriture du projet : une virgule, un deux-points ou une
       parenthèse. Les commentaires de code peuvent les garder, eux ne
       s'affichent pas. */
    const fautifs = [];
    for (const f of ['assets/app.js', 'assets/store.js', 'index.html']) {
      const s = lire(f);
      vrai(s, f + ' doit être lisible pour ce contrôle');
      const vu = texteAffiche(s);
      for (let i = 0; i < vu.length; i++)
        if (vu[i] === '—')
          fautifs.push(f + ' ligne ' + (s.slice(0, i).split('\n').length));
    }
    eq(fautifs.length, 0, 'tiret cadratin affiché : ' + fautifs.join(', '));
  });

  test('la carte d’évolution n’existe qu’en un seul exemplaire', () => {
    /* Elle a d'abord ete ecrite deux fois, pour deux ecrans, et elle a diverge
       en silence : l'accueil passait par pointsEvolution() et savait faire net,
       les releves appelaient historySeries() et tracaient toujours le brut,
       sous le meme titre. Deux cartes de meme nom montrant deux chiffres.

       Elle n'est plus affichee qu'a un seul endroit, l'accueil : sur les
       releves elle redisait cet accueil ET le tableau juste en dessous, qui
       donne les memes montants mois par mois avec leur ecart. Cette page sert a
       saisir. Le controle garde ce qui reste vrai : le balisage vit dans une
       fonction, jamais recopie, pour que la deuxieme vue qui en voudra une
       reprenne celle-ci. */
    vrai(source, 'app.js doit être lisible pour ce contrôle');
    /* Le titre passe par `trad()` depuis qu'il se traduit : le controle suit la
       phrase, qui est justement la clef du dictionnaire, et non le balisage. */
    /* La liste de reglage de l'accueil nomme la carte par la meme clef : c'est
       son nom, pas une copie de son balisage, et elle est ecartee du compte. */
    const registre = source.slice(source.indexOf('const CARTES_APERCU_VUE = {'),
                                  source.indexOf('\n};\n', source.indexOf('const CARTES_APERCU_VUE = {')));
    vrai(/evolution: +\{ nom: \(\) => trad\('Évolution du patrimoine'\), rendu: \(\) => carteEvolution\(\) \}/.test(registre),
      'la liste de réglage nomme la carte et appelle son rendu');
    const titres = source.replace(registre, '').match(/trad\('Évolution du patrimoine'\)/g) || [];
    eq(titres.length, 1,
      'la carte d’évolution doit être écrite une fois et appelée deux : ' + titres.length + ' exemplaires');
    /* Sa definition et son appel : le balisage ne doit jamais etre recopie
       dans une vue, meme s'il n'y en a plus qu'une a l'afficher. */
    const appels = source.match(/carteEvolution\(/g) || [];
    vrai(appels.length >= 2,
      'carteEvolution doit être définie une fois et appelée, jamais recopiée');
  });

  test('l’onglet « Charges fixes » ne porte pas de pastille', () => {
    /* Le libellé occupe 78 px des 88 px utiles d'un onglet de barre à TROIS
       onglets, à 375 px. Nu il tient sur une ligne ; une pastille ajoute 6 px
       plus son écart, le texte passe à la ligne et la barre gagne 17 px.

       Budget n'en porte plus que deux depuis que l'historique est passé sur la
       vue d'ensemble, donc chaque onglet dispose de 168 px et la contrainte est
       levée pour lui. L'invariant reste : il ne coûte rien, et un troisième
       onglet peut revenir sans que personne se rappelle ce calcul.

       Mesuré, pas supposé. Le contrôle ne refait pas le calcul de pixels : il
       garde l'invariant qui le rend inutile. */
    vrai(source, 'app.js doit être lisible pour ce contrôle');
    const bloc = source.match(/const PASTILLE_SOUS_ONGLET = \{([\s\S]*?)\n\};/);
    vrai(bloc, 'PASTILLE_SOUS_ONGLET doit rester repérable dans le source');
    const cles = [...bloc[1].matchAll(/^\s*(\w+)\s*:/gm)].map(m => m[1]);
    vrai(cles.length > 0, 'le bloc doit porter au moins une clé, sinon la regex a glissé');
    eq(cles.includes('cadre'), false,
      'une pastille sur « Charges fixes » casse la barre en deux lignes à 375 px');
  });

  test('une grille à un seul enfant retombe sur une colonne', () => {
    /* Le trou est arrivé trois fois : deux tiers de contenu, un tiers de vide,
       parce qu'une carte avait quitté une grille à deux colonnes sans que la
       grille le sache. La règle CSS le rend impossible.

       La sonde porte sa propre classe à deux colonnes. Sa spécificité (0,1,0)
       est plus faible que celle de `.grid:has(> :only-child)` (0,2,0) : si la
       règle existe, elle gagne. Un style en ligne, lui, l'écraserait, et le
       test ne prouverait rien. */
    const style = document.createElement('style');
    style.textContent = '.sonde-grille{display:grid;grid-template-columns:1fr 1fr}';
    document.head.appendChild(style);
    const boite = document.createElement('div');
    boite.className = 'grid sonde-grille';
    document.body.appendChild(boite);

    const colonnes = () => getComputedStyle(boite).gridTemplateColumns.split(' ').length;
    try {
      boite.innerHTML = '<div>seul</div>';
      eq(colonnes(), 1, 'un enfant doit occuper toute la largeur');
      boite.innerHTML = '<div>un</div><div>deux</div>';
      eq(colonnes(), 2, 'deux enfants gardent les deux colonnes');
    } finally {
      boite.remove();
      style.remove();
    }
  });
});

finDePartieDeTests('tests/05-charges-fixes-se-rangent.tests.js');
