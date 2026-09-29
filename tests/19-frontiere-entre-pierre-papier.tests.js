partieDeTests('tests/19-frontiere-entre-pierre-papier.tests.js');
/* Deux fuites restaient : des metres carres et une adresse sur une SCPI, et un
   bouton « + Charge » qui lui proposait une taxe fonciere. Chacune invite a
   saisir quelque chose qui n'existe pas — et la taxe fonciere, saisie, aurait
   ampute le rendement de charges payees par la gerance. */
suite('La frontière entre pierre et papier passe aussi par les champs', () => {

  const bloc = (nom) => {
    const src = lireSource('assets/app.js');
    const i = src.indexOf(`function ${nom}(`);
    vrai(i > 0, `${nom} doit être trouvable`);
    const suivante = Math.min(...[src.indexOf('\nfunction ', i + 1),
                                  src.indexOf('\nconst ', i + 1)]
      .filter(x => x > 0).concat([src.length]));
    return src.slice(i, suivante);
  };
  const espace = () => {
    const src = lireSource('assets/app.js');
    return src.slice(src.indexOf('function espaceBien'),
                     src.indexOf('function barreValiderFiche'));
  };

  const poser = ({ type = 'scpi', surface = 0, adresse = '' } = {}) => Fixture.poser(s => {
    s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: [] }];
    s.comptes = [{ id: 'c_p', etabId: 'e_bq', type, statut: 'ouvert', libelle: 'Placement',
      cash: [], lignes: [{ id: 'l0', classe: 'immobilier', libelle: 'Parts',
        valeur: 100000, prixDeRevient: 90000,
        ...(surface ? { surface } : {}), ...(adresse ? { adresse } : {}) }] }];
    s.positions = []; s.monthly = [];
    s.budget.income = [{ label: 'Distribution', amount: 400, period: 'mois', bienId: 'c_p' }];
    s.budget.fixedCharges = [];
  });

  test('un placement n’a ni surface, ni adresse, ni usage résidentiel', () => {
    /* Les trois champs se tiennent a la MEME frontiere de modele. Une seule
       question posee trois fois : ce bien, le detient-on physiquement. */
    const e = espace();
    vrai(/\$\{!estBienEnDirect\(c\) \? '' : `<div class="field"><label>\$\{trad\('Surface \(m²\)'\)\}/.test(e),
      'la surface ne s’écrit que pour un bien détenu en direct');
    vrai(/\$\{!estBienEnDirect\(c\) \? '' : `<div class="field"><label>\$\{trad\('Adresse'\)\}<\/label>/.test(e),
      'l’adresse non plus');
    vrai(/\$\{!estBienEnDirect\(c\) \? '' : `<div class="field"><label>\$\{trad\('Usage'\)\}/.test(e),
      'et l’usage résidentiel pas davantage');
    /* Trois gardes, et pas une de plus ni de moins : le compte le dit. */
    eq((e.match(/\$\{!estBienEnDirect\(c\) \? '' :/g) || []).length, 3,
      'trois champs physiques, trois gardes');
  });

  test('le prix au m² ne s’affiche pas sur une part de SCPI', () => {
    /* Il ne dependait que de la surface : une valeur legacy suffisait donc a
       faire apparaitre un prix au metre carre pour des parts, et l'aide invitait
       a le comparer aux annonces du quartier. */
    const e = espace();
    vrai(/if \(!estBienEnDirect\(c\) \|\| !surface \|\| !entiere\) return '';/.test(e),
      'le bloc du prix au m² se tait pour un placement');
    /* Et il reste pour un bien physique, qui est tout son intérêt. */
    vrai(/trad\('Prix au m²'\)/.test(e), 'le bloc existe toujours');
  });

  test('une surface ou une adresse legacy ne s’efface jamais', () => {
    /* Elles ne s'affichent plus ; elles ne se suppriment pas. Personne ne peut
       savoir pourquoi elles ont ete saisies, et un effacement automatique
       emporterait une donnee que son detenteur n'a pas demande a perdre. */
    poser({ surface: 42, adresse: '12 rue des Lilas' });
    const l = compteById('c_p').lignes[0];
    eq(num(l.surface), 42, 'la surface reste dans les données');
    eq(l.adresse, '12 rue des Lilas', 'l’adresse aussi');
    /* Aucune migration ne les touche. */
    refreshAccounts();
    eq(num(compteById('c_p').lignes[0].surface), 42, 'après un recalcul, toujours là');
    eq(compteById('c_p').lignes[0].adresse, '12 rue des Lilas', 'toujours là aussi');
    const store = lireSource('assets/store.js');
    vrai(!/delete l\.surface|delete l\.adresse/.test(store),
      'et rien dans le modèle ne les supprime');
  });

  test('un bien détenu en direct garde ses champs physiques', () => {
    poser({ type: 'immo', surface: 42, adresse: '12 rue des Lilas' });
    eq(estBienEnDirect(compteById('c_p')), true, 'il est détenu physiquement');
    /* La garde est une condition, pas une suppression : le meme code sert les
       deux cas, et le bien physique passe par la branche qui affiche. */
    const e = espace();
    /* Les trois motifs s'ecrivent en clair. Les construire depuis une chaine
       demandait un niveau d'echappement de plus a chaque etage, et c'est
       exactement la que celui de l'usage s'etait perdu : il cherchait
       `<label>trad('Usage')` quand la source ecrit `<label>${trad('Usage')}`. */
    vrai(/estBienEnDirect\(c\) \? '' : `<div class="field"><label>\$\{trad\('Surface \(m²\)'\)\}/.test(e),
      'la surface reste offerte au bien physique');
    vrai(/estBienEnDirect\(c\) \? '' : `<div class="field"><label>\$\{trad\('Adresse'\)\}<\/label>/.test(e),
      'l’adresse aussi');
    vrai(/estBienEnDirect\(c\) \? '' : `<div class="field"><label>\$\{trad\('Usage'\)\}/.test(e),
      'et l’usage résidentiel');
    vrai(/data-path="comptes\.\$\{idx\}\.lignes\.\$\{i\}\.surface"/.test(e),
      'et la surface garde son champ de saisie');
    vrai(/data-path="comptes\.\$\{idx\}\.lignes\.\$\{i\}\.adresse"/.test(e),
      'l’adresse aussi');
  });

  test('les postes proposés à un placement ne sont pas ceux d’un logement', () => {
    /* Une SCPI n'a ni taxe fonciere, ni copropriete, ni provision pour travaux :
       la gerance les porte deja dans ce qu'elle distribue. Les saisir une
       seconde fois amputerait le rendement de charges payees par un autre. */
    poser();
    const postes = chargesProposees(compteById('c_p')).map(([l]) => l);
    for (const logement of ['Taxe foncière', 'Charges de copropriété',
                            'Provision pour travaux', 'Assurance habitation',
                            'Assurance propriétaire non occupant', 'Taxe d’habitation',
                            'Frais de gestion locative']) {
      eq(postes.includes(logement), false, `« ${logement} » n’est pas proposé à un placement`);
    }
    eq(postes.join(', '), 'Frais de gestion, Frais de plateforme, Frais de financement, Autres frais',
      'ce sont des frais de placement, dans l’ordre où on y pense');
    /* Deux listes, et aucune ne connait les postes de l'autre. */
    const store = lireSource('assets/store.js');
    vrai(/if \(!estBienEnDirect\(compte\)\) return FRAIS_PIERRE_PAPIER;/.test(store),
      'la frontière du modèle choisit la liste');
    for (const [poste] of FRAIS_PIERRE_PAPIER)
      eq(Object.values(CHARGES_BIEN).flat().some(([l]) => l === poste), false,
        `« ${poste} » ne vit que dans la liste des placements`);
  });

  test('un bien direct garde ses postes de propriétaire, selon son usage', () => {
    for (const [usage, attendu] of [
      ['principale', 'Assurance habitation'],
      ['secondaire', 'Taxe d’habitation'],
      ['locative', 'Assurance propriétaire non occupant'],
    ]) {
      poser({ type: 'immo' });
      compteById('c_p').lignes[0].usage = usage;
      const postes = chargesProposees(compteById('c_p')).map(([l]) => l);
      eq(postes.includes('Taxe foncière'), true, `${usage} : la taxe foncière reste proposée`);
      eq(postes.includes(attendu), true, `${usage} : et « ${attendu} » avec elle`);
      eq(postes.includes('Frais de plateforme'), false,
        `${usage} : aucun frais de placement`);
    }
  });

  test('les quatre parcours restent distincts', () => {
    /* Un bouton de revenu selon le monde, un bouton de charge selon le monde :
       quatre combinaisons, et aucune n'emprunte le mot de l'autre. */
    const pp = bloc('boutonsPierrePapier');
    vrai(/trad\('Distribution'\)/.test(pp), 'pierre papier : + Distribution');
    vrai(/trad\('\+ Frais'\)/.test(pp), 'pierre papier : + Frais');
    vrai(!/\+ Charge/.test(pp), 'et jamais + Charge');
    vrai(!/trad\('Loyer'\)/.test(pp), 'ni + Loyer');

    const br = bloc('boutonsRattachement');
    vrai(/usage !== 'locative' \? '' :/.test(br),
      '+ Loyer reste réservé au bien loué en direct');
    vrai(/trad\('\+ Charge'\)/.test(br), 'et + Charge vaut pour les trois usages directs');
    vrai(!/Distribution/.test(br) && !/\+ Frais/.test(br),
      'les mots du placement ne remontent pas ici');

    /* Deux fonctions plutot qu'un helper a trois libelles : chacune se lit
       d'un coup. */
    vrai(/function boutonsPierrePapier\(c\) \{/.test(lireSource('assets/app.js')),
      'la pierre papier a sa propre fonction');
    vrai(/function boutonsRattachement\(c, usage\) \{/.test(lireSource('assets/app.js')),
      'et celle du bien direct retrouve ses deux paramètres');
    /* Et chaque carte appelle la sienne. */
    vrai(/\$\{boutonsPierrePapier\(c\)\}/.test(bloc('cartePierrePapier')),
      'la fiche du placement appelle la sienne');
    vrai(/boutonsRattachement\(c, usage\)/.test(bloc('carteResidence')),
      'celle du logement passe son usage');
    vrai(/boutonsRattachement\(c, 'locative'\)/.test(bloc('carteLocatif')),
      'et celle du locatif le sien');
  });

  test('la fenêtre de frais parle de frais, et crée une vraie charge du budget', () => {
    const src = lireSource('assets/app.js');
    /* La borne haute est l'action SUIVANTE dans le fichier. « ajouter-placement »
       vit plus haut : la tranche etait donc vide, et le controle ne verifiait
       rien tout en passant pour vert sur ses regex. */
    const action = src.slice(src.indexOf("async 'ajouter-charge-bien'(btn) {"),
                             src.indexOf("async 'ajouter-credit'(btn) {"));
    vrai(action.length > 500, 'l’action doit être trouvable');
    vrai(/const direct = estBienEnDirect\(c\);/.test(action), 'la fenêtre lit le modèle');
    vrai(/\(direct \? trad\('Charge de \{v\}'\) : trad\('Frais de \{v\}'\)\)/.test(action),
      'et son titre suit');
    vrai(/label: direct \? 'Poste' : 'Type de frais'/.test(action), 'le champ aussi');
    /* La periode par defaut et l'exemple se lisent du premier poste propose :
       rien d'autre n'a a connaitre les deux mondes. */
    vrai(/valeur: proposes\[0\]\[1\]/.test(action),
      'la période par défaut vient de la liste, donc du bon monde');
    vrai(/trad\('ex\. \{v\}'\)\.replace\('\{v\}', trad\(proposes\[0\]\[0\]\)\)/.test(action),
      'et l’exemple aussi');
    /* Le mecanisme du budget est inchange : meme rattachement, meme periode. */
    vrai(/Store\.state\.budget\.fixedCharges\.push\(\{/.test(action),
      'une charge fixe du budget, comme avant');
    vrai(/bienId: c\.id/.test(action), 'rattachée au placement par son bienId');
  });

  test('un frais rattaché à un placement se comporte comme une charge du budget', () => {
    /* La semantique change, la mecanique non : meme `bienId`, meme periode,
       meme entree dans le budget. */
    poser();
    const avant = { brut: round2(patrimoine().brut), net: round2(patrimoine().net),
                    dettes: round2(dettesTotal()), fixe: round2(budgetFrame().fixed) };
    Store.state.budget.fixedCharges.push({ label: 'Frais de gestion', amount: 240,
      period: 'an', shares: {}, bienId: 'c_p' });
    refreshAccounts();
    const cf = cashFlowBien(compteById('c_p'));
    eq(cf.postesCharge.length, 1, 'le frais est vu par la fiche du placement');
    pres(cf.charges, 20, 'deux cent quarante par an font vingt par mois');
    pres(round2(budgetFrame().fixed), avant.fixe + 20, 'et le budget le compte une fois');
    /* Il ne touche ni le patrimoine ni la dette : c'est un flux, pas un solde. */
    pres(round2(patrimoine().brut), avant.brut, 'le patrimoine brut ne bouge pas');
    pres(round2(patrimoine().net), avant.net, 'le net non plus');
    pres(round2(dettesTotal()), avant.dettes, 'ni les dettes');
    /* Et le net mensuel du placement le retranche une seule fois. */
    pres(cf.loyersPleins - cf.charges - cf.mensualite, 400 - 20, 'le net mensuel suit');
  });

  test('aucune SCPI n’est requalifiée, et rien n’est supprimé', () => {
    poser({ surface: 42, adresse: '12 rue des Lilas' });
    const lignes = JSON.stringify(compteById('c_p').lignes);
    const revenus = JSON.stringify(Store.state.budget.income);
    chargesProposees(compteById('c_p'));
    cashFlowBien(compteById('c_p'));
    coutBien(compteById('c_p'));
    usageEffectifBien(compteById('c_p'));
    eq(JSON.stringify(compteById('c_p').lignes), lignes, 'les lignes sont intactes');
    eq(JSON.stringify(Store.state.budget.income), revenus, 'les revenus aussi');
    eq(compteById('c_p').lignes[0].usage, undefined, 'et aucun usage n’a été inventé');
    pres(round2(patrimoine().brut), 100000, 'la valeur des parts est celle qu’on a saisie');
  });
});

/* Un zero n'est pas un prix. La ligne le disait deja — « prix de revient
   manquant », et les deux performances muettes — mais trois chemins le
   laissaient s'installer, et un quatrieme le transformait en chiffre. */
suite('Un prix de revient ne s’invente pas, et ne reste pas vide', () => {

  const src = () => lireSource('assets/app.js');
  const bloc = (nom) => {
    const s = src();
    const i = s.indexOf(`function ${nom}(`);
    vrai(i > 0, `${nom} doit être trouvable`);
    const suivante = Math.min(...[s.indexOf('\nfunction ', i + 1),
                                  s.indexOf('\nconst ', i + 1)]
      .filter(x => x > 0).concat([s.length]));
    return s.slice(i, suivante);
  };

  test('la moyenne pondérée ne dilue plus le prix payé par une base absente', () => {
    /* Quarante titres sans base, dix achetes a 20. L'ancienne formule faisait
       entrer l'ancien lot A ZERO -- comme s'il avait ete recu gratuitement --
       et ecrivait un PRU de 4. La ligne annonçait alors +400 %, un chiffre faux
       et confiant la ou il n'y avait qu'une donnee manquante. */
    const ligne = (buyPrice) => ({ qty: 50, buyPrice, price: 20, fx: 1, currency: 'EUR' });

    const dilue = (40 * 0 + 10 * 20) / 50;
    pres(dilue, 4, 'la moyenne pondérée avec un zéro donne quatre');
    pres(posInvested(ligne(dilue)), 200, 'soit deux cents euros d’investi pour mille de valeur');
    vrai(posPerfPct(ligne(dilue)) > 300,
      'et la ligne afficherait plus de trois cents pour cent de gain');

    /* Avec la base declaree, le PRU reste dans le bon ordre de grandeur. */
    const juste = (40 * 18 + 10 * 20) / 50;
    pres(juste, 18.4, 'l’ancien lot à dix-huit, le nouveau à vingt');
    pres(posInvested(ligne(juste)), 920, 'neuf cent vingt euros investis');
    vrai(Math.abs(posPerfPct(ligne(juste))) < 20, 'et une performance plausible');

    /* Le code lit la base declaree, et non plus un `p.buyPrice` a zero. */
    const s = src();
    vrai(/const pruAvant = num\(p\.buyPrice\) \|\| num\(base\);/.test(lireSource('assets/store.js')),
      'l’ancien lot entre au prix déclaré quand la ligne n’en portait aucun');
    vrai(/const pru = round4\(\(anciennes \* pruAvant \+ cout\) \/ qtyFinale\);/.test(lireSource('assets/store.js')),
      'et la moyenne pondérée part de lui');
    vrai(!/anciennes \* num\(p\.buyPrice\) \+ cout/.test(s),
      'l’ancienne formule, qui prenait un zéro pour un prix, est partie');
  });

  test('la fenêtre d’achat exige le prix payé', () => {
    const f = bloc('askBuy');
    vrai(/cle: 'price'[\s\S]{0,80}requis: true/.test(f), 'le prix unitaire est obligatoire');
    vrai(/valeur: num\(p\.price\) \|\| ''/.test(f), 'et pré-rempli avec le dernier cours');
    /* `vide()` compte un zero comme vide sur un champ nombre : c'est ce qui
       fait mordre `requis` ici, et non le seul fait de laisser le champ blanc. */
    vrai(/if \(c\.type === 'nombre'\) return !num\(v\);/.test(src()),
      'et zéro compte comme vide sur un champ nombre, sinon la garde ne servirait à rien');
  });

  test('la fenêtre d’achat réclame la base manquante — et seulement alors', () => {
    const f = bloc('askBuy');
    vrai(/const baseManque = !p\.manual && num\(p\.qty\) > 0 && !num\(p\.buyPrice\);/.test(f),
      'la question ne se pose que sur une ligne qui porte des titres sans base');
    vrai(/\.\.\.\(!baseManque \? \[\] : \[\{/.test(f), 'et le champ n’existe que dans ce cas');
    vrai(/cle: 'basePrice', type: 'nombre', requis: true/.test(f), 'il est obligatoire');
    vrai(/Prix de revient des titres déjà détenus/.test(f), 'et se nomme sans ambiguïté');
    /* Une ligne dont la valeur se saisit en total porte sa base ailleurs : la
       moyenne ponderee ne la touche pas, donc la question ne lui est pas posee. */
    vrai(/!p\.manual/.test(f), 'une ligne saisie en total n’est pas concernée');
    /* Et la valeur remonte a l'appelant. */
    vrai(/base: num\(v\.basePrice\) \|\| null/.test(f), 'la réponse remonte avec l’achat');
  });

  test('créer une ligne cotée pré-remplit le prix au cours du jour', () => {
    /* Renversement assume : le cours ne servait que de repere en fond de champ,
       au motif qu'un prix de revient est ce qu'on a paye. L'alternative n'etait
       pourtant pas un champ rempli a la main, c'etait un ZERO garde tel quel. */
    const s = src();
    const i = s.indexOf("cle: 'buyPrice', type: 'nombre',");
    vrai(i > 0, 'le champ doit être trouvable');
    const champ = s.slice(i, s.indexOf('},', i));
    vrai(/valeur: cote \? cote\.price : ''/.test(champ), 'le cours du jour remplit le champ');
    vrai(/requis: v => num\(v\.qty\) > 0/.test(champ),
      'et il devient obligatoire dès qu’une quantité est saisie');
    vrai(/pré-rempli au cours du jour/.test(champ), 'l’aide dit d’où vient la valeur');
    vrai(/ce que tu as payé peut être différent/.test(champ), 'et qu’elle se corrige');
    /* Sans quantite, rien n'est exige : on installe aussi une ligne avant de
       l'acheter, et c'est ce que dit l'aide de la quantite. */
    vrai(/laisse zéro si tu n’as pas encore acheté/.test(s),
      'une ligne peut naître avant son achat');
  });

  test('un champ obligatoire peut dépendre d’un autre', () => {
    /* La dependance ne peut pas se decider au moment ou le champ est construit :
       elle se lit au moment ou l'on valide. Un booleen reste un booleen. */
    const s = src();
    vrai(/const estRequis = c => typeof c\.requis === 'function' \? c\.requis\(out\) : c\.requis;/
      .test(s), 'requis accepte une fonction des valeurs saisies');
    vrai(/champs\.find\(c => estRequis\(c\) && vide\(c\)\)/.test(s),
      'et la garde passe par elle');
  });

  test('la fiche refuse d’enregistrer des titres sans prix de revient', () => {
    const s = src();
    const i = s.indexOf('const baseManquante = () => {');
    vrai(i > 0, 'la garde doit être trouvable');
    const garde = s.slice(i, s.indexOf('const enregistrer', i));
    /* La valeur se lit dans le CHAMP : la saisie de cette fiche est differee,
       donc l'etat porte encore l'ancienne valeur au moment du controle. */
    vrai(/champ\.value/.test(garde), 'la valeur se lit dans le champ, pas dans l’état');
    vrai(/p\.manual \? 'invested' : 'buyPrice'/.test(garde),
      'et sur le bon champ selon le régime de la ligne');
    vrai(/titres > 0 && !num\(champ\.value\) \? champ : null/.test(garde),
      'une ligne sans titre n’a rien à déclarer');
    /* L'enregistrement s'arrete, et le dit. */
    vrai(/const manque = baseManquante\(\);[\s\S]{0,220}return false;/.test(s),
      'enregistrer refuse et rend faux');
    vrai(/manque\.focus\(\);/.test(s), 'en désignant le champ');
  });

  test('fermer sans enregistrer reste possible', () => {
    /* On refuse d'ENREGISTRER un silence definitif ; on n'oblige personne a
       remplir pour abandonner ses modifications. */
    const s = src();
    vrai(/if \(garder && !enregistrer\(\)\) return;/.test(s),
      '« Enregistrer et fermer » ne ferme que si l’enregistrement a eu lieu');
    vrai(/refus: 'Fermer sans enregistrer'/.test(s),
      'et l’abandon reste offert');
  });

  test('rien de tout cela ne change ce qu’une base absente affiche', () => {
    /* L'invariant d'avant tient : sans base, les deux performances se taisent
       plutot que d'annoncer un zero ou la valeur entiere de la ligne. */
    const sansBase = { qty: 40, buyPrice: 0, price: 20, fx: 1, currency: 'EUR' };
    eq(posInvested(sansBase), 0, 'aucun investi');
    eq(posPerfPct(sansBase), null, 'aucun pourcentage');
    eq(posPerfEur(sansBase), null, 'et aucun euro de plus-value');
    pres(posValue(sansBase), 800, 'la valeur, elle, reste connue');
  });
});

/* « Prix d'acquisition » nommait tantot le prix, tantot le prix frais compris,
   selon qui remplissait le champ — et l'ecart entre les deux vaut les frais de
   notaire, sept a huit pour cent. Un intitule qui peut vouloir dire deux choses
   finit par vouloir dire la mauvaise. */
suite('Un coût d’acquisition se décompose, il ne se devine pas', () => {

  const lot = (o = {}) => Fixture.poser(s => {
    s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: o.credits || [] }];
    s.comptes = [{ id: 'c_b', etabId: 'e_bq', type: 'immo', statut: 'ouvert',
      libelle: 'Appartement', cash: [], ...(estDeclare(o.apport) ? { apport: o.apport } : {}),
      lignes: [{ id: 'l0', classe: 'immobilier', libelle: 'Appartement',
        valeur: o.valeur == null ? 370000 : o.valeur,
        ...(estDeclare(o.part) ? { part: o.part } : {}),
        ...(estDeclare(o.prixAchat) ? { prixAchat: o.prixAchat } : {}),
        ...(estDeclare(o.frais) ? { fraisAcquisition: o.frais } : {}),
        ...(estDeclare(o.travaux) ? { travauxInitiaux: o.travaux } : {}),
        ...(estDeclare(o.legacy) ? { prixDeRevient: o.legacy } : {}),
        usage: o.usage || 'principale' }] }];
    s.positions = []; s.monthly = [];
    s.budget.income = o.loyer
      ? [{ label: 'Loyer', amount: o.loyer, period: 'mois', bienId: 'c_b' }] : [];
    s.budget.fixedCharges = [];
  });
  const a = () => acquisitionLigne(compteById('c_b').lignes[0]);

  test('les trois montants s’additionnent, et le total ne se saisit pas', () => {
    /* UN SOUS-TOTAL N'EST PAS UN COUT TOTAL. Tant qu'un poste manque, la somme
       des autres ne dit pas ce que le bien a coute : elle dit ce qu'on en sait.
       Le total officiel n'existe qu'une fois les trois montants declares. */
    lot({ prixAchat: 300000 });
    pres(a().sousTotal, 300000, 'le prix seul fait un sous-total');
    eq(a().total, null, 'mais aucun coût total : les frais et les travaux sont inconnus');
    eq(a().source, 'partiel', 'et l’état se nomme');
    lot({ prixAchat: 300000, frais: 24000 });
    pres(a().sousTotal, 324000, 'le prix et les frais');
    eq(a().total, null, 'toujours aucun coût total');
    lot({ prixAchat: 300000, frais: 24000, travaux: 10000 });
    pres(a().sousTotal, 334000, 'les trois');
    pres(a().total, 334000, 'et le coût total existe enfin');
    eq(a().complet, true, 'le détail est entier');
    eq(a().source, 'detail', 'il vient des composants, pas d’un total saisi');
    /* Rien ne stocke le total : il se recalcule, donc il ne peut pas diverger
       de ses parts. */
    eq(compteById('c_b').lignes[0].coutTotal, undefined, 'aucun total en double dans les données');
  });

  test('vide n’est pas zéro, et zéro n’est pas vide', () => {
    /* Des travaux a zero disent « il n'y en a pas eu » ; des travaux absents ne
       disent rien. Le total est le meme, la completude non — et c'est elle qui
       decide si l'ecran ose l'appeler « cout total ». */
    lot({ prixAchat: 300000, frais: 24000, travaux: 0 });
    pres(a().total, 324000, 'des travaux nuls n’ajoutent rien');
    eq(a().travaux, 0, 'mais ils sont déclarés');
    eq(a().complet, true, 'donc le détail est entier, et le coût total existe');

    lot({ prixAchat: 300000, frais: 24000 });
    pres(a().sousTotal, 324000, 'le même sous-total sans les travaux');
    eq(a().total, null, 'mais aucun coût total : la différence est là');
    eq(a().travaux, null, 'ils sont inconnus');
    eq(a().complet, false, 'et le détail est partiel');

    lot({ prixAchat: 300000, frais: 0 });
    eq(a().frais, 0, 'des frais nuls se déclarent aussi');
    lot({ prixAchat: 300000 });
    eq(a().frais, null, 'des frais absents restent absents');
    /* La convention vient d'`estDeclare`, la meme que partout. */
    const st = lireSource('assets/store.js');
    vrai(/const dit = cle => estDeclare\(l\?\.\[cle\]\) \? num\(l\[cle\]\) : null;/.test(st),
      'la convention passe par estDeclare, pas par la vérité JS');
  });

  test('un ancien bien garde son total, et rien ne s’en déduit', () => {
    lot({ legacy: 334000 });
    pres(a().total, 334000, 'la valeur legacy vaut le coût total');
    eq(a().source, 'legacy', 'et l’écran sait d’où elle vient');
    eq(a().prixAchat, null, 'aucun prix d’achat inventé');
    eq(a().frais, null, 'aucuns frais inventés');
    eq(a().travaux, null, 'aucuns travaux inventés');
    eq(a().complet, false, 'le détail n’est pas renseigné');
    /* Et l'ecran le dit, plutot que d'afficher un detail vide. */
    const src = lireSource('assets/app.js');
    vrai(/if \(a\.source === 'legacy'\) return `/.test(src), 'la carte reconnaît ce cas');
    vrai(/Détail non renseigné/.test(src), 'et le nomme');
    vrai(/rien n’est deviné à partir du total/.test(src), 'en disant pourquoi');
    /* Et les deux autres etats ont chacun leur phrase. */
    vrai(/if \(a\.source === 'partiel'\) return `/.test(src), 'un détail partiel sans legacy aussi');
    vrai(/trad\('Sous-total renseigné'\)/.test(src), 'qui parle de sous-total');
    vrai(/trad\('À compléter'\)/.test(src), 'et de coût total à compléter');

    /* LE LEGACY TIENT TANT QUE LE DETAIL N'EST PAS ENTIER.

       Basculer des le premier champ rempli etait le piege : un ancien bien a
       334 000 EUR dont on commence a saisir le prix (300 000) et les frais
       (24 000) aurait vu sa base tomber a 324 000. Les travaux ne sont pas nuls,
       ils sont inconnus, et le total officiel aurait chute de dix mille euros
       pendant que quelqu'un essayait justement d'ameliorer sa saisie. */
    lot({ legacy: 334000, prixAchat: 300000 });
    pres(a().total, 334000, 'le total officiel reste celui du legacy');
    eq(a().source, 'legacy', 'nommément');
    pres(a().sousTotal, 300000, 'et le sous-total dit ce qui est saisi');

    lot({ legacy: 334000, prixAchat: 300000, frais: 24000 });
    pres(a().total, 334000, 'toujours le legacy');
    pres(a().sousTotal, 324000, 'et un sous-total qui s’approche');
    eq(a().complet, false, 'le détail n’est pas entier');

    /* Une fois les trois declares, le detail prend le relais — et le legacy
       n'est jamais efface, personne ne sachant ce qu'il contenait. */
    lot({ legacy: 334000, prixAchat: 300000, frais: 24000, travaux: 10000 });
    pres(a().total, 334000, 'le détail donne le même total, et prend le relais');
    eq(a().source, 'detail', 'nommément');
    lot({ legacy: 334000, prixAchat: 275000, frais: 20000, travaux: 5000 });
    pres(a().total, 300000, 'un détail entier différent fait foi');
    eq(a().source, 'detail', 'sans aucune correction automatique');
    eq(num(compteById('c_b').lignes[0].prixDeRevient), 334000,
      'et l’ancienne valeur reste dans les données, jamais détruite');
  });

  test('la valeur et le coût se comparent à la même échelle', () => {
    /* Comparer la moitie d'une valeur au cout TOTAL ferait apparaitre une perte
       a qui n'a rien perdu. La quote-part s'applique aux deux, une seule fois,
       dans `lignesDe`. */
    lot({ prixAchat: 300000, frais: 24000, travaux: 10000, valeur: 370000 });
    const acq = acquisitionCompte(compteById('c_b'));
    pres(acq.entier, 334000, 'le coût du bien entier');
    pres(acq.detenu, 334000, 'et la part détenue, sans quote-part');
    pres(lignesDe(compteById('c_b'))[0].prixDeRevient, 334000,
      'la ligne rend le coût total, pas le seul prix d’achat');
    pres(lignesDe(compteById('c_b'))[0].valeur - lignesDe(compteById('c_b'))[0].prixDeRevient,
      36000, 'trente-six mille euros d’écart');

    lot({ prixAchat: 300000, frais: 24000, travaux: 10000, valeur: 370000, part: 50 });
    const moitie = acquisitionCompte(compteById('c_b'));
    pres(moitie.entier, 334000, 'le coût du bien entier ne bouge pas');
    pres(moitie.detenu, 167000, 'la moitié est détenue');
    const l = lignesDe(compteById('c_b'))[0];
    pres(l.valeur, 185000, 'la moitié de la valeur');
    pres(l.prixDeRevient, 167000, 'et la moitié du coût');
    pres(l.valeur - l.prixDeRevient, 18000, 'l’écart reste la moitié, pas une perte inventée');
  });

  test('la base des rendements est le coût total, et se dit', () => {
    lot({ prixAchat: 300000, frais: 24000, travaux: 10000, valeur: 370000,
          usage: 'locative', loyer: 1200 });
    const cf = cashFlowBien(compteById('c_b'));
    pres(cf.base, 334000, 'la base est le coût total, frais et travaux compris');
    eq(cf.surAchat, true, 'et l’écran le dit');
    pres(cf.rendementBrut, 1200 * 12 / 334000 * 100, 'le rendement suit');

    /* Sans acquisition, la base retombe sur la valeur du jour, et l'ecran
       l'annonce — c'est la regle posee en C. */
    lot({ valeur: 370000, usage: 'locative', loyer: 1200 });
    const sans = cashFlowBien(compteById('c_b'));
    pres(sans.base, 370000, 'la valeur du jour prend le relais');
    eq(sans.surAchat, false, 'et le changement de base se dit');

    /* Sans base du tout, aucun rendement : la regle de C.1 tient. */
    lot({ valeur: 0, usage: 'locative', loyer: 1200 });
    eq(cashFlowBien(compteById('c_b')).rendementBrut, null, 'aucune base, aucun rendement');
  });

  test('le haut de fiche lit le coût total, jamais le champ legacy en direct', () => {
    /* Le defaut exact : un bien dont le detail est renseigne — prix, frais,
       travaux — mais qui n'a jamais porte de `prixDeRevient` affichait un cout
       de zero, donc AUCUN ecart. La ligne la plus regardee de la fiche
       disparaissait au moment ou l'on venait justement de la renseigner. C'est
       la divergence que la porte unique existe pour empecher. */
    const src = lireSource('assets/app.js');
    const haut = src.slice(src.indexOf('function espaceBien'),
                           src.indexOf('function barreValiderFiche'));
    vrai(/const achatEntier = biens\.reduce\(\(s, \{ l \}\) => s \+ \(coutAcquisition\(l\) \|\| 0\), 0\);/
      .test(haut), 'le coût entier passe par coutAcquisition');
    vrai(/s \+ \(coutAcquisition\(l\) \|\| 0\) \* \(partDetention\(l\) \?\? 0\)/.test(haut),
      'la part détenue aussi, et une part invalide écarte le lot au lieu de valoir le tout');
    vrai(!/num\(l\.prixDeRevient\)/.test(haut),
      'et le champ legacy ne se lit plus en direct dans la fiche');

    /* Et la preuve par les nombres : detail seul, sans legacy. */
    lot({ prixAchat: 300000, frais: 24000, travaux: 10000, valeur: 370000 });
    eq(compteById('c_b').lignes[0].prixDeRevient, undefined, 'aucun champ legacy');
    pres(coutAcquisition(compteById('c_b').lignes[0]), 334000, 'le coût se calcule quand même');
    pres(lignesDe(compteById('c_b'))[0].prixDeRevient, 334000, 'et la ligne le porte');
  });

  test('« plus-value » a laissé la place à un écart comptable', () => {
    /* Longward ne calcule ni frais de revente, ni abattement pour duree de
       detention, ni fiscalite de cession. Appeler ce chiffre une plus-value
       laisserait croire qu'il dit ce qu'on encaisserait. */
    const src = lireSource('assets/app.js');
    const haut = src.slice(src.indexOf('function espaceBien'),
                           src.indexOf('function barreValiderFiche'));
    vrai(/Écart vs coût d’acquisition/.test(haut), 'la fiche parle d’un écart');
    vrai(!/Plus-value latente/.test(haut.replace(/\/\*[\s\S]*?\*\//g, '')),
      'et plus d’une plus-value');
    vrai(/ni les frais de revente ni la fiscalité de cession/.test(haut),
      'l’aide dit ce que Longward ne sait pas');
  });
});

/* Un apport est un fait d'hier. Il ne s'ajoute a rien aujourd'hui, il ne se
   retire de rien, et c'est justement pour ca qu'on l'oublie. */
suite('Un apport est un fait d’hier, pas un mouvement d’aujourd’hui', () => {

  const bien = (apport, o = {}) => Fixture.poser(s => {
    s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: o.credits || [] }];
    s.comptes = [
      { id: 'c_cash', etabId: 'e_bq', type: 'courant', statut: 'ouvert', libelle: 'Compte',
        cash: [{ id: 'x', usage: 'depenser', montant: 12000 }], lignes: [] },
      { id: 'c_b', etabId: 'e_bq', type: 'immo', statut: 'ouvert', libelle: 'Appartement',
        cash: [], ...(apport === undefined ? {} : { apport }),
        lignes: [{ id: 'l0', classe: 'immobilier', libelle: 'Appartement', valeur: 370000,
                   prixAchat: 300000, fraisAcquisition: 24000, travauxInitiaux: 10000,
                   usage: o.usage || 'locative' }] }];
    s.positions = []; s.monthly = [];
    s.budget.income = o.loyer
      ? [{ label: 'Loyer', amount: o.loyer, period: 'mois', bienId: 'c_b' }] : [];
    s.budget.fixedCharges = [];
  });

  test('absent, il reste inconnu ; nul, il est une réponse', () => {
    bien(undefined);
    eq(apportDeclare(compteById('c_b')), null, 'un apport jamais saisi est inconnu');
    bien(0);
    eq(apportDeclare(compteById('c_b')), 0, 'un apport nul déclaré vaut zéro');
    bien(80000);
    eq(apportDeclare(compteById('c_b')), 80000, 'et un apport positif vaut ce qu’il vaut');
    /* `num(x) || null` confondait les deux premiers, et taisait le cas le plus
       net : un achat finance a cent pour cent. */
    const st = lireSource('assets/store.js');
    vrai(/const apportDeclare = compte => estDeclare\(compte\?\.apport\) \? num\(compte\.apport\) : null;/
      .test(st), 'la convention passe par estDeclare');
  });

  test('il ne touche ni le patrimoine, ni le cash, ni le budget', () => {
    bien(undefined);
    const avant = { brut: round2(patrimoine().brut), net: round2(patrimoine().net),
                    dettes: round2(dettesTotal()), fixe: round2(budgetFrame().fixed),
                    revenus: round2(budgetFrame().income) };
    for (const v of [0, 80000, 250000]) {
      bien(v);
      pres(round2(patrimoine().brut), avant.brut, `apport ${v} : le patrimoine brut`);
      pres(round2(patrimoine().net), avant.net, `apport ${v} : le net`);
      pres(round2(dettesTotal()), avant.dettes, `apport ${v} : les dettes`);
      pres(round2(budgetFrame().fixed), avant.fixe, `apport ${v} : les charges fixes`);
      pres(round2(budgetFrame().income), avant.revenus, `apport ${v} : les revenus`);
      pres(round2(valeurCompte(compteById('c_cash'))), 12000, `apport ${v} : le cash`);
    }
    /* Et rien ne l'ecrit dans un credit ni dans une poche. */
    const st = lireSource('assets/store.js');
    vrai(!/cash[^;]*=[^;]*apport|\.montant\s*=[^;]*apport/.test(st),
      'rien n’écrit un solde depuis l’apport');
  });

  test('le rendement sur apport n’existe pas sans apport, et ne divise pas par zéro', () => {
    bien(undefined, { loyer: 1500 });
    const inconnu = cashFlowBien(compteById('c_b'));
    eq(inconnu.apport, null, 'aucun apport');
    eq(inconnu.cashOnCash, null, 'donc aucun rendement sur apport');
    eq(inconnu.sansApport, false, 'et ce n’est pas un financement sans apport : on ne sait pas');

    bien(0, { loyer: 1500 });
    const zero = cashFlowBien(compteById('c_b'));
    eq(zero.apport, 0, 'un apport nul déclaré');
    eq(zero.sansApport, true, 'c’est un financement à cent pour cent, et ça se nomme');
    eq(zero.cashOnCash, null, 'aucun pourcentage : diviser par zéro rendrait l’infini');
    vrai(Number.isFinite(zero.cashFlow), 'et le cash-flow reste un nombre');

    bien(60000, { loyer: 1500 });
    const avec = cashFlowBien(compteById('c_b'));
    pres(avec.cashOnCash, avec.cashFlow * 12 / 60000 * 100, 'avec un apport, le ratio existe');
  });

  test('il ne se divise jamais par la quote-part', () => {
    /* Il represente l'argent reellement sorti de la poche du detenteur, pas une
       fraction d'un apport commun. Le diviser ferait un rendement sur apport
       deux fois trop grand sur un bien detenu a moitie. */
    bien(80000, { loyer: 1500 });
    compteById('c_b').lignes[0].part = 50;
    refreshAccounts();
    eq(apportDeclare(compteById('c_b')), 80000, 'l’apport reste entier');
    /* L'assertion porte sur le CODE : le champ de la fiche lit l'apport tel
       qu'il est declare, sans le passer par `partDetention`. Un controle pose
       sur le commentaire voisin serait vert ici et muet sur l'arbre publie, ou
       les commentaires sont retires. */
    const src = lireSource('assets/app.js');
    const champ = src.slice(src.indexOf("trad('Apport initial ({dev})')"),
                            src.indexOf('${blocFinancementInitial(c)}'));
    vrai(champ.length > 100, 'le champ doit être trouvable');
    vrai(/estDeclare\(c\.apport\) \? num\(c\.apport\) : ''/.test(champ),
      'le champ rend l’apport tel qu’il est déclaré');
    vrai(!/partDetention/.test(champ), 'et aucune quote-part ne s’y applique');
    /* Ni ailleurs : rien dans le modele ne multiplie l'apport par une part. */
    const st = lireSource('assets/store.js');
    vrai(!/apport[^;\n]*partDetention|partDetention[^;\n]*apport/.test(st),
      'ni dans le modèle');
  });
});

/* Le capital restant du et le capital EMPRUNTE sont deux montants differents.
   Prendre le premier pour le second ferait afficher « 0 % rembourse » a qui a
   paye la moitie de son pret. */
suite('Le capital emprunté et le capital restant dû sont deux montants', () => {

  const pret = (o = {}) => ({ id: 'd1', libelle: 'Prêt', montant: o.montant,
    ...(estDeclare(o.initial) ? { initial: o.initial } : {}),
    ...(estDeclare(o.taux) ? { taux: o.taux } : {}),
    ...(estDeclare(o.mensualite) ? { mensualite: o.mensualite } : {}),
    ...(estDeclare(o.tauxAssurance) ? { tauxAssurance: o.tauxAssurance } : {}),
    bienId: 'c_b' });

  const bien = (credits) => Fixture.poser(s => {
    s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: credits }];
    s.comptes = [{ id: 'c_b', etabId: 'e_bq', type: 'immo', statut: 'ouvert',
      libelle: 'Appartement', cash: [],
      lignes: [{ id: 'l0', classe: 'immobilier', libelle: 'Appartement', valeur: 370000,
                 prixAchat: 300000, usage: 'principale' }] }];
    s.positions = []; s.monthly = [];
    s.budget.income = []; s.budget.fixedCharges = [];
  });
  const p = () => progressionCredit(Store.state.etabs[0].dettes[0]);

  test('capital remboursé = emprunté − restant dû, et son pourcentage', () => {
    bien([pret({ montant: 187000, initial: 240000 })]);
    pres(p().initial, 240000, 'le capital emprunté');
    pres(p().reste, 187000, 'le capital restant dû');
    pres(p().rembourse, 53000, 'et la différence');
    pres(p().pct, 53000 / 240000 * 100, 'soit vingt-deux pour cent');
    eq(p().incoherent, false, 'rien à signaler');

    /* Un pret solde : tout est rembourse, et le pourcentage vaut cent. */
    bien([pret({ montant: 0, initial: 240000 })]);
    pres(p().rembourse, 240000, 'un prêt soldé a tout remboursé');
    pres(p().pct, 100, 'soit cent pour cent');
  });

  test('sans capital emprunté, la progression n’existe pas — elle ne vaut pas zéro', () => {
    bien([pret({ montant: 187000 })]);
    eq(p().initial, null, 'aucun capital emprunté déclaré');
    eq(p().rembourse, null, 'donc aucun capital remboursé');
    eq(p().pct, null, 'et aucun pourcentage');
    pres(p().reste, 187000, 'le restant dû, lui, reste connu');
    /* Un capital emprunte declare a ZERO n'est pas un montant de pret. */
    bien([pret({ montant: 187000, initial: 0 })]);
    eq(p().initial, null, 'un capital emprunté nul n’est pas un montant de prêt');
    /* Et l'ecran demande la piece manquante au lieu d'afficher une barre vide. */
    const src = lireSource('assets/app.js');
    vrai(/prog\.initial == null \? '' : `\n?\s*<div class="goal-bar"/.test(src),
      'la barre de progression ne s’affiche pas sans capital emprunté');
    vrai(/Renseigne le capital emprunté au départ pour voir ce qui est déjà remboursé/.test(src),
      'et l’écran dit quoi remplir');
  });

  test('un restant dû plus grand que l’emprunté se signale, sans se corriger', () => {
    /* Frais finances, regroupement, pret rechargeable : ca arrive, et ce n'est
       pas toujours une faute. Un capital rembourse negatif serait faux dans les
       deux sens. */
    bien([pret({ montant: 250000, initial: 240000 })]);
    eq(p().incoherent, true, 'l’incohérence se dit');
    eq(p().rembourse, null, 'et aucun capital remboursé négatif n’est rendu');
    pres(num(Store.state.etabs[0].dettes[0].montant), 250000, 'le restant dû n’a pas été retouché');
    pres(num(Store.state.etabs[0].dettes[0].initial), 240000, 'ni le capital emprunté');
    const src = lireSource('assets/app.js');
    vrai(/Le capital restant dû dépasse le capital emprunté au départ/.test(src),
      'la carte le nomme');
    vrai(/Longward ne tranche pas/.test(src), 'et ne corrige rien');
  });

  test('aucun crédit, un crédit, plusieurs crédits', () => {
    bien([]);
    eq(creditsDuBien(compteById('c_b')).length, 0, 'aucun crédit');
    eq(coutBien(compteById('c_b')).mensualite, 0, 'aucune mensualité');
    eq(coutBien(compteById('c_b')).capitalMois, null, 'et aucun capital remboursé');

    bien([pret({ montant: 200000, initial: 240000, taux: 2, mensualite: 1000 })]);
    eq(creditsDuBien(compteById('c_b')).length, 1, 'un crédit');
    pres(coutBien(compteById('c_b')).mensualite, 1000, 'sa mensualité');

    bien([pret({ montant: 200000, initial: 240000, taux: 2, mensualite: 1000 }),
          { id: 'd2', libelle: 'Prêt travaux', montant: 50000, initial: 60000,
            taux: 3, mensualite: 400, bienId: 'c_b' }]);
    eq(creditsDuBien(compteById('c_b')).length, 2, 'deux crédits');
    pres(coutBien(compteById('c_b')).mensualite, 1400, 'les mensualités se somment');
    const dettes = Store.state.etabs[0].dettes;
    pres(progressionCredit(dettes[0]).rembourse, 40000, 'chacun garde sa progression');
    pres(progressionCredit(dettes[1]).rembourse, 10000, 'la sienne');
    pres(round2(dettesTotal()), 250000, 'et la dette totale les additionne');
  });

  test('le capital restant déclaré ne se remplace jamais par une projection', () => {
    bien([pret({ montant: 200000, initial: 240000, taux: 2, mensualite: 1000 })]);
    const d = Store.state.etabs[0].dettes[0];
    d.verifieLe = '2026-01-15';
    const pr = projectionCredit(d);
    vrai(pr.moisDepuis > 0, 'des mois ont passé depuis la vérification');
    vrai(pr.projete != null && pr.projete < 200000, 'la projection descend');
    pres(num(d.montant), 200000, 'mais le montant déclaré n’a pas bougé');
    const st = lireSource('assets/store.js');
    vrai(!/d\.montant\s*=\s*[^;]*projete|montant:\s*projete/.test(st),
      'rien n’écrit le capital depuis la projection');
    const src = lireSource('assets/app.js');
    vrai(/Longward ne l’écrit jamais à ta place/.test(src), 'et la carte le dit');
  });
});

/* Zero est un taux, l'absence n'en est pas un. La regle est verrouillee depuis
   la refonte immobiliere ; D ne la desserre nulle part. */
suite('Un taux déclaré à zéro reste zéro, un taux absent reste absent', () => {

  const pret = (taux) => Fixture.poser(s => {
    s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: [{ id: 'd1', libelle: 'Prêt',
      montant: 200000, initial: 240000, mensualite: 1000, bienId: 'c_b',
      ...(taux === undefined ? {} : { taux }) }] }];
    s.comptes = [{ id: 'c_b', etabId: 'e_bq', type: 'immo', statut: 'ouvert',
      libelle: 'Appartement', cash: [],
      lignes: [{ id: 'l0', classe: 'immobilier', libelle: 'Appartement', valeur: 370000,
                 prixAchat: 300000, usage: 'principale' }] }];
    s.positions = []; s.monthly = [];
    s.budget.income = []; s.budget.fixedCharges = [];
  });
  const d = () => Store.state.etabs[0].dettes[0];

  test('un taux positif ventile et donne une fin', () => {
    pret(2);
    const e = echeancierCredit(d());
    pres(e.interetsDuMois, 200000 * 0.02 / 12, 'les intérêts du mois');
    vrai(e.capitalDuMois > 0, 'du capital se rembourse');
    vrai(finCredit(d()), 'et la date de fin existe');
  });

  test('un taux déclaré à zéro s’amortit tout droit', () => {
    pret(0);
    eq(tauxCreditDeclare(d()), 0, 'zéro est un taux déclaré');
    const e = echeancierCredit(d());
    pres(e.interetsDuMois, 0, 'aucun intérêt');
    pres(e.capitalDuMois, 1000, 'toute la mensualité rembourse du capital');
    eq(e.amortissable, true, 'et la dette s’éteint');
    pres(finCredit(d()).mois, 200, 'deux cents échéances');
    /* Il survit a une relecture et a une reecriture : c'est la ou `|| null` le
       rangeait parmi les inconnus. */
    d().taux = num(d().taux);
    eq(tauxCreditDeclare(d()), 0, 'après relecture, toujours zéro');
    const src = lireSource('assets/app.js');
    vrai(/estDeclare\(d\.taux\) \? num\(d\.taux\) : ''/.test(src),
      'le champ de la fiche le rend tel quel');
    vrai(/taux: estDeclare\(e3\.taux\) \? num\(e3\.taux\) : null/.test(src),
      'et la création l’écrit tel quel');
  });

  test('un taux absent n’invente ni ventilation ni date de fin', () => {
    pret(undefined);
    eq(tauxCreditDeclare(d()), null, 'aucun taux');
    const e = echeancierCredit(d());
    eq(e.capitalDuMois, null, 'aucune part de capital');
    eq(e.interetsDuMois, null, 'aucun intérêt');
    eq(finCredit(d()), null, 'et aucune date de fin');
    eq(coutBien(compteById('c_b')).ventilation, 'aucune', 'la ventilation se tait');
    const src = lireSource('assets/app.js');
    vrai(/Renseigne le taux pour estimer la répartition capital\/intérêts et la date de fin/
      .test(src), 'et la carte dit quoi remplir');
  });
});

/* Une mensualite contient son assurance : c'est le prelevement qu'on lit sur son
   releve, et c'est lui que le budget compte. */
suite('Une mensualité contient son assurance, et le dit', () => {

  const pret = (o) => Fixture.poser(s => {
    s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: [{ id: 'd1', libelle: 'Prêt',
      montant: 200000, mensualite: 1000, taux: 2, bienId: 'c_b', ...o }] }];
    s.comptes = [{ id: 'c_b', etabId: 'e_bq', type: 'immo', statut: 'ouvert',
      libelle: 'Appartement', cash: [],
      lignes: [{ id: 'l0', classe: 'immobilier', libelle: 'Appartement', valeur: 370000,
                 prixAchat: 300000, usage: 'principale' }] }];
    s.positions = []; s.monthly = [];
    s.budget.income = []; s.budget.fixedCharges = [];
  });
  const d = () => Store.state.etabs[0].dettes[0];

  test('capital + intérêts + assurance font la mensualité', () => {
    pret({ initial: 240000, tauxAssurance: 0.3 });
    const e = echeancierCredit(d());
    const assur = assuranceMensuelleCredit(d());
    pres(assur, 240000 * 0.003 / 12, 'la prime, sur le capital emprunté');
    pres(e.capitalDuMois + e.interetsDuMois + assur, 1000,
      'les trois parts refont la mensualité, au centime');
    const co = coutBien(compteById('c_b'));
    pres(co.capitalMois + co.horsCapital, co.totalSorties, 'et le coût se referme aussi');
  });

  test('l’assurance dit sur quelle base elle est calculée', () => {
    /* La plupart des contrats la calculent sur le capital EMPRUNTE. Sans lui, on
       retombe sur le restant du — la prime est alors sous-estimee, ce qui est le
       bon sens de l'erreur — mais ce repli ne doit pas etre silencieux. */
    pret({ initial: 240000, tauxAssurance: 0.3 });
    eq(baseAssuranceCredit(d()).sur, 'initial', 'avec le capital emprunté, c’est lui');
    pres(baseAssuranceCredit(d()).base, 240000, 'et la base le vaut');

    pret({ tauxAssurance: 0.3 });
    eq(baseAssuranceCredit(d()).sur, 'restant', 'sans lui, le restant dû sert de base');
    pres(baseAssuranceCredit(d()).base, 200000, 'nommément');
    pres(assuranceMensuelleCredit(d()), 200000 * 0.003 / 12, 'et la prime est sous-estimée');
    const src = lireSource('assets/app.js');
    vrai(/base\.sur === 'initial' \? '' :/.test(src), 'la carte ne le dit que dans ce cas');
    vrai(/Estimée sur le capital restant dû, faute de capital emprunté renseigné/.test(src),
      'et elle le dit');
  });

  test('l’assurance ne crée aucune seconde sortie de trésorerie', () => {
    /* Elle est deja dans la mensualite : une charge d'assurance de plus
       sortirait deux fois du compte. */
    pret({ initial: 240000, tauxAssurance: 0.3 });
    Store.state.budget.fixedCharges = [{ label: 'Mensualité', amount: 1000, period: 'mois',
                                         shares: {}, creditId: 'd1', bienId: 'c_b' }];
    d().mensualite = null;
    refreshAccounts();
    pres(round2(budgetFrame().fixed), 1000, 'le budget compte la mensualité, une fois');
    pres(coutBien(compteById('c_b')).totalSorties, 1000, 'et le coût du bien aussi');
    pres(coutBien(compteById('c_b')).autresCharges, 0,
      'la charge qui rembourse le crédit n’est pas comptée en plus');
    const src = lireSource('assets/app.js');
    vrai(/il ne crée aucune sortie de plus, l’assurance étant déjà comprise dedans/.test(src),
      'et le champ du taux le dit');
  });

  test('un prêt qui ne s’amortit pas n’invente aucune échéance', () => {
    pret({ montant: 200000, taux: 12, mensualite: 500, initial: 200000 });
    const e = echeancierCredit(d());
    eq(e.amortissable, false, 'la dette ne s’éteint jamais');
    eq(finCredit(d()), null, 'aucune date de fin');
    eq(coutBien(compteById('c_b')).capitalMois, 0,
      'le capital remboursé vaut zéro — connu, pas inconnu');
    const src = lireSource('assets/app.js');
    vrai(/La mensualité actuelle ne réduit pas le capital/.test(src), 'et l’écran le dit');
  });
});

/* Creer un bien ne doit forcer aucune donnee inconnue : le minimum est un nom,
   un usage et une valeur. Tout le reste s'enrichit ensuite. */
suite('Créer un bien ne force aucune donnée inconnue', () => {

  const parcours = () => {
    const src = lireSource('assets/app.js');
    return src.slice(src.indexOf("async 'ajouter-compte'"),
                     src.indexOf("'fiche-compte'(btn)"));
  };

  test('le parcours se lit par étapes, et chacune se nomme', () => {
    const p = parcours();
    vrai(/\{ cle: 'section_acq', label: 'Acquisition', type: 'section' \}/.test(p),
      'l’acquisition est une étape');
    vrai(/\{ cle: 'section_fin', label: 'Financement', type: 'section' \}/.test(p),
      'le financement aussi');
    /* Une section ne porte aucune valeur : les deux lectures l'ignorent. */
    const src = lireSource('assets/app.js');
    vrai(/if \(c\.type === 'section'\)/.test(src), 'askForm sait la rendre');
    vrai(/if \(!el \|\| el\.closest\('\.field'\)\?\.hidden\) continue;/.test(src),
      'et la lecture des valeurs passe son chemin, y compris sur un champ masqué');
  });

  test('seuls le nom, l’usage et la valeur sont exigés', () => {
    const p = parcours();
    /* L'usage est le seul champ obligatoire de l'immobilier : c'est lui qui
       decide de tout ce que la fiche montre ensuite. */
    vrai(/cle: 'usageBien'[\s\S]{0,120}requis: true/.test(p), 'l’usage est obligatoire');
    for (const cle of ['prixAchat', 'fraisAcquisition', 'travauxInitiaux',
                       'initial', 'apport', 'mensualite', 'taux', 'tauxAssurance']) {
      vrai(!new RegExp(`cle: '${cle}'[^}]*requis`).test(p),
        `« ${cle} » reste facultatif : personne n’invente un chiffre pour finir`);
    }
  });

  test('un champ traversé sans rien taper ne devient pas un zéro', () => {
    const p = parcours();
    for (const cle of ['prixAchat', 'fraisAcquisition', 'travauxInitiaux']) {
      vrai(new RegExp(`estDeclare\\(e3\\.${cle}\\)`).test(p),
        `« ${cle} » ne s’écrit que s’il est déclaré`);
    }
    vrai(/const apportDit = estDeclare\(e3\.apport\) \? num\(e3\.apport\) : null;/.test(p),
      'l’apport non plus');
    vrai(/apportDit === null \? \{\} : \{ apport: apportDit \}/.test(p),
      'et il n’entre dans le compte que déclaré');
    /* Le `&& > 0` qui trainait ici rangeait un ZERO DECLARE parmi les inconnus,
       sur le seul chemin ou il survivait encore. Un zero avec une dette qui
       reste se refuse a la validation, il ne s'efface pas en silence. */
    vrai(/initial: estDeclare\(e3\.initial\) \? num\(e3\.initial\) : null/.test(p),
      'le capital emprunté garde son zéro déclaré');
    vrai(!/estDeclare\(e3\.initial\) && num\(e3\.initial\) > 0/.test(p),
      'et le seuil qui l’effaçait est parti');
  });

  test('un crédit créé porte son bienId dès sa naissance', () => {
    /* Le repli « un seul compte chez ce preteur » reste une lecture
       conservatrice pour les anciennes donnees ; aucun enregistrement nouveau
       n'en depend. */
    const p = parcours();
    vrai(/bienId: id,/.test(p), 'le lien est posé à la création');
    const i = p.indexOf('let id = ');
    const j = p.indexOf('bienId: id');
    vrai(i > 0 && j > i, 'et l’identifiant du compte est tiré avant le crédit');
    /* Et le repli reste une lecture, jamais une ecriture : rien ne cree un
       credit en comptant sur « un seul compte chez ce preteur ». */
    vrai(!/bienId: null|bienId: undefined/.test(p),
      'aucun crédit ne naît sans son bien');
    vrai(/etabSansAmbiguite/.test(lireSource('assets/store.js')),
      'le repli existe encore, pour les anciennes données');
  });

  test('la pierre papier ne reçoit pas l’onboarding du bien physique', () => {
    const p = parcours();
    /* Les trois champs d'acquisition et l'apport sont gardes par le meme
       drapeau que l'usage : `immoDirect`, soit un bien immobilier detenu en
       direct. Une SCPI garde son « montant investi », qui est son prix de
       souscription — et un bien de valeur aussi. */
    vrai(/\.\.\.\(immoDirect \? \[\n?\s*\{ cle: 'section_acq'/.test(p),
      'l’acquisition détaillée est réservée au logement détenu en direct');
    vrai(/\.\.\.\(!immoDirect \? \[\] : \[\n?\s*\{ cle: 'apport'/.test(p),
      'l’apport aussi');
    vrai(/cle: 'revient', label: trad\('Montant investi \({dev}\)'\)/.test(p),
      'et la pierre papier garde son montant investi');
  });
});

/* D ne change ni ce que vaut un patrimoine, ni ce que coute un mois. Elle change
   ce qu'on sait en dire. */
suite('D ne change ni le patrimoine, ni les dettes, ni le Budget', () => {

  /* Le meme bien, decrit de deux facons economiquement identiques : un total
     legacy d'un cote, son detail de l'autre. */
  const poser = (detail) => Fixture.poser(s => {
    s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: [{ id: 'd1', libelle: 'Prêt',
      montant: 187000, initial: 240000, taux: 2.8, mensualite: 1180,
      tauxAssurance: 0.3, bienId: 'c_b' }] }];
    s.comptes = [{ id: 'c_b', etabId: 'e_bq', type: 'immo', statut: 'ouvert',
      libelle: 'Appartement', cash: [], apport: 80000,
      lignes: [{ id: 'l0', classe: 'immobilier', libelle: 'Appartement', valeur: 370000,
        usage: 'principale',
        ...(detail ? { prixAchat: 300000, fraisAcquisition: 24000, travauxInitiaux: 10000 }
                   : { prixDeRevient: 334000 }) }] }];
    s.positions = []; s.monthly = [];
    s.budget.income = [];
    s.budget.fixedCharges = [{ label: 'Mensualité', amount: 1180, period: 'mois',
                               shares: {}, creditId: 'd1', bienId: 'c_b' },
                             { label: 'Taxe foncière', amount: 250, period: 'mois',
                               shares: {}, bienId: 'c_b' }];
  });

  const photo = () => ({
    brut: round2(patrimoine().brut), net: round2(patrimoine().net),
    dettes: round2(dettesTotal()),
    fixe: round2(budgetFrame().fixed), revenus: round2(budgetFrame().income),
    cout: round2(coutBien(compteById('c_b')).totalSorties),
    base: round2(cashFlowBien(compteById('c_b')).base),
  });

  test('le détail et le total legacy décrivent le même patrimoine', () => {
    poser(false);
    const legacy = photo();
    poser(true);
    const detail = photo();
    for (const clef of Object.keys(legacy))
      eq(detail[clef], legacy[clef], `${clef} ne bouge pas`);
    pres(legacy.base, 334000, 'et la base vaut le coût total dans les deux cas');
  });

  test('la mensualité ne se compte qu’une fois, et le capital ne rejoint pas le cash', () => {
    poser(true);
    pres(round2(budgetFrame().fixed), 1430, 'la mensualité et la taxe, une fois chacune');
    const co = coutBien(compteById('c_b'));
    pres(co.mensualite, 1180, 'la mensualité vient de la charge qui rembourse');
    pres(co.autresCharges, 250, 'et cette charge n’est pas comptée en plus');
    pres(co.totalSorties, 1430, 'le total sort une seule fois');
    vrai(co.capitalMois > 0, 'du capital se rembourse');
    pres(co.totalSorties, co.mensualite + co.autresCharges,
      'et le total ne s’allège pas de la part de capital : cet argent sort bien');
    const src = lireSource('assets/app.js');
    vrai(!/capitalMois \+ [^;]*cashFlow|cashFlow \+ [^;]*capitalMois/.test(src),
      'et il ne s’ajoute à aucun cash-flow');
  });

  test('les fondations d’A, B et C tiennent', () => {
    poser(true);
    /* A : le credit appartient explicitement a son bien, et rien n'est mort. */
    eq(Store.state.etabs[0].dettes[0].bienId, 'c_b', 'le crédit désigne son bien');
    eq(creditsAClarifier().length, 0, 'aucune référence à clarifier');
    /* B : l'usage declare est la source de verite. */
    eq(usageEffectifBien(compteById('c_b')).source, 'declare', 'l’usage vient d’une déclaration');
    /* C : une residence principale ne parle pas rendement. */
    const src = lireSource('assets/app.js');
    const residence = src.slice(src.indexOf('function carteResidence'),
                                src.indexOf('function carteLocatif'))
      .replace(/\/\*[\s\S]*?\*\//g, '');
    vrai(!/Rendement/.test(residence), 'et la carte du logement n’en montre aucun');
    /* C.1 : la pierre papier garde sa fiche. */
    vrai(/if \(!estBienEnDirect\(c\)\) return cartePierrePapier\(c, idx, cf\);/.test(src),
      'la pierre papier garde la sienne');
    /* C.2 : et ses frais, pas des charges de proprietaire. */
    vrai(/if \(!estBienEnDirect\(compte\)\) return FRAIS_PIERRE_PAPIER;/
      .test(lireSource('assets/store.js')), 'avec sa propre liste de frais');
  });
});

/* Un sous-total n'est pas un cout total, et le legacy tient jusqu'a ce que la
   decomposition soit entiere. Basculer des le premier champ rempli faisait
   tomber la base pendant qu'on ameliorait sa saisie. */
suite('Un détail partiel ne se fait pas passer pour un coût total', () => {

  const lot = (o = {}) => Fixture.poser(s => {
    s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: [] }];
    s.comptes = [{ id: 'c_b', etabId: 'e_bq', type: 'immo', statut: 'ouvert',
      libelle: 'Appartement', cash: [],
      lignes: [{ id: 'l0', classe: 'immobilier', libelle: 'Appartement',
        valeur: o.valeur == null ? 370000 : o.valeur, usage: 'locative',
        ...(estDeclare(o.legacy) ? { prixDeRevient: o.legacy } : {}),
        ...(estDeclare(o.prixAchat) ? { prixAchat: o.prixAchat } : {}),
        ...(estDeclare(o.frais) ? { fraisAcquisition: o.frais } : {}),
        ...(estDeclare(o.travaux) ? { travauxInitiaux: o.travaux } : {}) }] }];
    s.positions = []; s.monthly = [];
    s.budget.income = o.loyer
      ? [{ label: 'Loyer', amount: o.loyer, period: 'mois', bienId: 'c_b' }] : [];
    s.budget.fixedCharges = [];
  });
  const a = () => acquisitionLigne(compteById('c_b').lignes[0]);

  test('les quatre cas, dans l’ordre où on les rencontre', () => {
    /* A — le legacy seul. */
    lot({ legacy: 334000 });
    pres(a().total, 334000, 'A : le total officiel est le legacy');
    eq(a().source, 'legacy', 'A : et il le dit');
    eq(a().sousTotal, null, 'A : aucun sous-total, rien n’est saisi');

    /* B — le legacy tient tant que le detail n'est pas entier. */
    lot({ legacy: 334000, prixAchat: 300000 });
    pres(a().total, 334000, 'B : le total officiel ne bouge pas');
    pres(a().sousTotal, 300000, 'B : le sous-total dit ce qui est saisi');
    eq(a().complet, false, 'B : le détail est partiel');

    lot({ legacy: 334000, prixAchat: 300000, frais: 24000 });
    pres(a().total, 334000, 'B : toujours le legacy, à deux champs sur trois');
    pres(a().sousTotal, 324000, 'B : et le sous-total s’approche');

    /* C — le detail entier prend le relais. */
    lot({ legacy: 334000, prixAchat: 300000, frais: 24000, travaux: 10000 });
    eq(a().source, 'detail', 'C : le détail fait foi');
    eq(a().complet, true, 'C : il est entier');
    pres(a().total, 334000, 'C : et donne le coût total');
    lot({ legacy: 334000, prixAchat: 305000, frais: 24000, travaux: 11000 });
    pres(a().total, 340000, 'C : un détail entier différent fait foi tel quel');
    eq(num(compteById('c_b').lignes[0].prixDeRevient), 334000,
      'C : sans corriger le legacy, ni le détail');

    /* D — un detail partiel SANS legacy n'est pas un cout total. */
    lot({ prixAchat: 300000 });
    eq(a().total, null, 'D : aucun coût total');
    pres(a().sousTotal, 300000, 'D : seulement un sous-total');
    eq(a().source, 'partiel', 'D : et l’état se nomme');
    lot({ prixAchat: 300000, frais: 24000 });
    eq(a().total, null, 'D : les travaux inconnus ne valent pas zéro');
    lot({ prixAchat: 300000, frais: 24000, travaux: 0 });
    pres(a().total, 324000, 'D : des travaux déclarés nuls, eux, complètent le détail');
  });

  test('un sous-total incomplet ne devient jamais une base de rendement', () => {
    /* C'est la consequence qui compte : la base des rendements et l'ecart avec
       la valeur du jour se calculent sur le cout total. Un sous-total ampute
       d'un poste ferait un rendement trop flatteur et un ecart trop beau. */
    lot({ prixAchat: 300000, frais: 24000, valeur: 370000, loyer: 1200 });
    const cf = cashFlowBien(compteById('c_b'));
    eq(coutAcquisition(compteById('c_b').lignes[0]), null, 'aucun coût total');
    pres(cf.base, 370000, 'la base retombe sur la valeur du jour');
    eq(cf.surAchat, false, 'et le changement de base se dit');
    pres(cf.rendementBrut, 1200 * 12 / 370000 * 100, 'le rendement suit cette base');
    /* Et l'ecart du haut de fiche ne se calcule pas non plus sur le sous-total. */
    pres(lignesDe(compteById('c_b'))[0].prixDeRevient, 0,
      'la ligne ne porte aucun coût, donc aucun écart n’est affiché');

    /* Des que le detail est entier, la base bascule — et le dit. */
    lot({ prixAchat: 300000, frais: 24000, travaux: 10000, valeur: 370000, loyer: 1200 });
    const entier = cashFlowBien(compteById('c_b'));
    pres(entier.base, 334000, 'la base devient le coût total');
    eq(entier.surAchat, true, 'et l’écran l’annonce');
  });

  test('le compte ne totalise pas des lots dont l’un ne dit pas son coût', () => {
    /* Additionner les lots connus et appeler la somme « coût du bien » ferait
       passer un total ampute d'un lot entier pour celui du projet. */
    Fixture.poser(s => {
      s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: [] }];
      s.comptes = [{ id: 'c_b', etabId: 'e_bq', type: 'immo', statut: 'ouvert',
        libelle: 'Immeuble', cash: [], lignes: [
          { id: 'l0', classe: 'immobilier', libelle: 'Appartement', valeur: 300000,
            prixAchat: 250000, fraisAcquisition: 20000, travauxInitiaux: 0 },
          { id: 'l1', classe: 'immobilier', libelle: 'Parking', valeur: 20000,
            prixAchat: 15000 }] }];
      s.positions = []; s.monthly = [];
      s.budget.income = []; s.budget.fixedCharges = [];
    });
    const acq = acquisitionCompte(compteById('c_b'));
    eq(acq.partiel, true, 'un lot ne dit pas son coût');
    eq(acq.total, null, 'donc le compte n’a pas de coût total');
    pres(acq.sousTotal, 285000, 'mais le sous-total additionne ce qui est saisi');
  });

  test('la carte nomme les trois états sans jamais les confondre', () => {
    const src = lireSource('assets/app.js');
    const carte = src.slice(src.indexOf('function carteAcquisition'),
                            src.indexOf('function blocFinancementInitial'));
    vrai(/if \(a\.complet\) return '';/.test(carte), 'un détail entier n’a rien à expliquer');
    vrai(/if \(a\.source === 'legacy'\) return `/.test(carte), 'le legacy a sa phrase');
    vrai(/if \(a\.source === 'partiel'\) return `/.test(carte), 'le partiel aussi');
    vrai(/c’est le total connu qui fait foi/.test(carte),
      'et le legacy dit qu’il fait toujours foi');
    vrai(/trad\('Sous-total renseigné'\)/.test(carte), 'le sous-total se nomme');
    vrai(/trad\('À compléter'\)/.test(carte), 'et le coût total se dit à compléter');
    /* Le total du compte ne s'affiche que s'il existe. */
    vrai(/acq\.total != null \? `<dt><b>\$\{trad\('Coût total d’acquisition'\)\}/.test(carte),
      'le coût total ne s’écrit que s’il y en a un');
    vrai(!/détail partiel/.test(carte),
      'et l’ancienne mention « détail partiel » sur un total est partie');
  });
});

/* « As-tu encore un credit sur ce bien ? » ne sert a rien si les six champs du
   pret restent la dessous : la question se pose, la reponse ne change rien. */
suite('Créer un bien se ramifie, et ne laisse pas naître un appartement à zéro', () => {

  const parcours = () => {
    const src = lireSource('assets/app.js');
    return src.slice(src.indexOf("async 'ajouter-compte'"),
                     src.indexOf("'fiche-compte'(btn)"));
  };

  test('la valeur devient obligatoire, et zéro ne passe pas', () => {
    /* Un appartement a zero euro n'existe pas, et il entrait pourtant au
       patrimoine sans un mot, faussant le brut, le net et les repartitions. */
    const p = parcours();
    vrai(/\{ cle: 'valeur', requis: true,/.test(p), 'la valeur est obligatoire');
    /* Et `vide()` compte un zero comme vide sur un champ nombre : c'est ce qui
       fait que « 0 » ne suffit pas a passer la garde. */
    vrai(/if \(c\.type === 'nombre'\) return !num\(v\);/.test(lireSource('assets/app.js')),
      'zéro compte comme vide sur un champ nombre');
    /* Le nom et l'usage restent exiges, chacun a sa place. */
    vrai(/cle: 'nom'[\s\S]{0,90}requis: true/.test(p),
      'le nom est obligatoire pour un bien sans contenant');
    vrai(/cle: 'usageBien'[\s\S]{0,120}requis: true/.test(p), 'et l’usage l’est toujours');
  });

  test('la question du crédit se pose, et sa réponse change ce qu’on voit', () => {
    const p = parcours();
    vrai(/cle: 'aCredit'[\s\S]{0,200}options: \[\['non', trad\('Non'\)\], \['oui', trad\('Oui'\)\]\]/
      .test(p), 'la question a deux réponses, et « non » par défaut');
    vrai(/const avecCredit = v => v\.aCredit === 'oui';/.test(p), 'elle commande une condition');
    /* Les six champs du pret et la case de la charge en dependent. */
    for (const cle of ['credit', 'initial', 'preteur', 'mensualite', 'taux',
                       'tauxAssurance', 'charge']) {
      vrai(new RegExp(`cle: '${cle}'[\\s\\S]{0,220}montreSi: avecCredit`).test(p),
        `« ${cle} » ne s’affiche que si la réponse est oui`);
    }
    /* L'apport, lui, ne depend pas du credit : un achat comptant en a un. */
    vrai(!/cle: 'apport'[\s\S]{0,200}montreSi/.test(p),
      'l’apport reste offert même sans crédit : un achat comptant en a un');
  });

  test('un champ masqué ne se lit pas, donc « non » ne crée aucun crédit', () => {
    /* Repondre « oui », saisir un montant, puis revenir a « non » creerait
       sinon un pret d'une reponse qu'on vient d'annuler. */
    const src = lireSource('assets/app.js');
    vrai(/if \(!el \|\| el\.closest\('\.field'\)\?\.hidden\) continue;/.test(src),
      'la lecture des valeurs saute un champ masqué');
    vrai(/hote\.hidden = !c\.montreSi\(out\)/.test(src), 'et la visibilité se recalcule');
    /* `majDerives` et non `majVisibles` : les champs masques et les champs
       calcules se refont a la meme occasion, sur une seule lecture de la
       fenetre. Deux cablages auraient fini par diverger. */
    vrai(/\$\('#modalBody'\)\.addEventListener\('input', majDerives\)/.test(src),
      'à chaque frappe');
    vrai(/const majDerives = \(\) => \{ majVisibles\(\); majCalculs\(\); \};/.test(src),
      'et la même frappe rafraîchit les champs dérivés');
    /* Et la creation ne pose un credit que si le capital restant est un nombre. */
    vrai(/if \(num\(e3\.credit\)\) \{/.test(parcours()),
      'sans capital restant, aucun crédit n’est créé');
  });

  test('la visibilité se calcule après les valeurs qu’elle lit', () => {
    /* `majVisibles` appelle `valeurs()`. Invoquee avant la ligne qui definit
       `valeurs`, elle levait une erreur de zone morte et la fenetre ne
       s'ouvrait pas du tout — sur le seul formulaire qui porte des champs
       conditionnels, donc le parcours de creation d'un bien.

       Aucun test d'execution ne pouvait le voir : le harnais ne charge pas
       app.js et n'appelle jamais `askForm`. L'ordre des lignes, lui, se lit. */
    const src = lireSource('assets/app.js');
    const i = src.indexOf('function askForm');
    const bloc = src.slice(i, src.indexOf('\nfunction ', i + 1));
    const defValeurs = bloc.indexOf('const valeurs = ');
    const appel = bloc.indexOf('majDerives();');
    const cablage = bloc.indexOf("addEventListener('input', majDerives)");
    vrai(defValeurs > 0 && appel > 0, 'les deux doivent être trouvables');
    vrai(appel > defValeurs,
      'majDerives() ne s’appelle qu’une fois valeurs() définie');
    vrai(cablage > defValeurs, 'et son câblage aussi');
    /* Et avant `depart` : un champ masque ne se lit pas, donc l'etat initial
       doit deja tenir compte de ce qui est cache. */
    const depart = bloc.indexOf('const depart = JSON.stringify(valeurs());');
    vrai(depart > appel, 'et avant le relevé de l’état de départ');
  });

  test('le reste de l’acquisition demeure facultatif', () => {
    const p = parcours();
    for (const cle of ['prixAchat', 'fraisAcquisition', 'travauxInitiaux',
                       'initial', 'apport', 'taux', 'tauxAssurance', 'mensualite']) {
      vrai(!new RegExp(`cle: '${cle}'[^}]*requis`).test(p),
        `« ${cle} » reste facultatif : personne n’invente un chiffre pour finir`);
    }
    /* Et le credit cree porte toujours son bien des sa naissance. */
    vrai(/bienId: id,/.test(p), 'le lien est posé à la création');
  });

  test('la pierre papier ne reçoit ni la question du crédit immobilier, ni les frais', () => {
    const p = parcours();
    vrai(/\.\.\.\(immoDirect \? \[\n?\s*\{ cle: 'section_acq'/.test(p),
      'l’acquisition détaillée reste réservée au logement détenu en direct');
    vrai(/cle: 'revient', label: trad\('Montant investi \({dev}\)'\)/.test(p),
      'et la pierre papier garde son montant investi');
  });
});

/* Le taux principal avait ete corrige ; ses voisins portaient la meme faute mot
   pour mot. Un aller-retour dans la fenetre suffisait a perdre « 0 % ». */
suite('Sur un crédit, vide et zéro ne se confondent plus nulle part', () => {

  const pret = (o) => Fixture.poser(s => {
    s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: [{ id: 'd1', libelle: 'Prêt',
      montant: 200000, bienId: 'c_b', ...o }] }];
    s.comptes = [{ id: 'c_b', etabId: 'e_bq', type: 'immo', statut: 'ouvert',
      libelle: 'Appartement', cash: [],
      lignes: [{ id: 'l0', classe: 'immobilier', libelle: 'Appartement', valeur: 370000,
                 prixAchat: 300000, fraisAcquisition: 24000, travauxInitiaux: 10000,
                 usage: 'principale' }] }];
    s.positions = []; s.monthly = [];
    s.budget.income = []; s.budget.fixedCharges = [];
  });
  const d = () => Store.state.etabs[0].dettes[0];

  test('plus aucune écriture ni relecture ne range un zéro parmi les inconnus', () => {
    const src = lireSource('assets/app.js');
    /* Les deux motifs qui confondaient : `|| null` a l'ecriture, `|| ''` a la
       relecture. Aucun des champs concernes ne doit plus les porter. */
    for (const cle of ['initial', 'mensualite', 'tauxAssurance', 'taux']) {
      vrai(!new RegExp(`num\\(v\\.${cle}\\) \\|\\|`).test(src),
        `« ${cle} » ne s’écrit plus par une vérité JS`);
      vrai(!new RegExp(`num\\(d\\.${cle}\\) \\|\\|`).test(src),
        `« ${cle} » ne se relit plus par une vérité JS`);
    }
    vrai(!/num\(e3\.mensualite\) \|\||num\(e3\.tauxAssurance\) \|\|/.test(src),
      'ni à la création d’un compte');
    /* Et tous passent par la meme porte. */
    const n = (src.match(/estDeclare\((?:v|d|e3|l)\.(?:initial|mensualite|tauxAssurance|taux)\)/g)
      || []).length;
    vrai(n >= 10, `les champs de crédit passent par estDeclare (${n} occurrences)`);
  });

  test('un taux d’assurance à zéro survit à l’aller-retour', () => {
    /* Creation, relecture, enregistrement sans y toucher : les trois etapes ou
       il disparaissait. */
    pret({ tauxAssurance: 0, taux: 2, mensualite: 1000 });
    eq(estDeclare(d().tauxAssurance), true, 'il est déclaré');
    eq(num(d().tauxAssurance), 0, 'et vaut zéro');
    pres(assuranceMensuelleCredit(d()), 0, 'donc aucune prime');
    /* La relecture rend « 0 » et non un champ vide. */
    const src = lireSource('assets/app.js');
    vrai(/valeur: estDeclare\(d\.tauxAssurance\) \? num\(d\.tauxAssurance\) : ''/.test(src),
      'la fenêtre le rouvre à zéro, pas à vide');
    vrai(/d\.tauxAssurance = estDeclare\(v\.tauxAssurance\) \? num\(v\.tauxAssurance\) : null;/
      .test(src), 'et l’enregistrement le garde à zéro');
    /* Absent, il reste absent. */
    pret({ taux: 2, mensualite: 1000 });
    eq(estDeclare(d().tauxAssurance), false, 'un taux d’assurance absent reste absent');
    pres(assuranceMensuelleCredit(d()), 0, 'et ne coûte rien non plus');
  });

  test('un capital emprunté nul avec une dette n’est pas « inconnu », il est invalide', () => {
    /* `|| null` le rangeait parmi les absents : la saisie impossible
       disparaissait sans un mot. Absent, invalide et zero declare sont trois
       etats distincts. */
    pret({ montant: 200000 });
    eq(progressionCredit(d()).initial, null, 'absent : rien à dire');
    eq(progressionCredit(d()).invalide, false, 'et rien d’invalide');

    pret({ montant: 200000, initial: 0 });
    eq(progressionCredit(d()).initial, null, 'zéro ne donne aucune progression');
    eq(progressionCredit(d()).invalide, true, 'mais il est signalé comme impossible');

    pret({ montant: 0, initial: 0 });
    eq(progressionCredit(d()).invalide, false,
      'un prêt soldé et déclaré à zéro des deux côtés ne dit rien d’impossible');

    pret({ montant: 200000, initial: 240000 });
    pres(progressionCredit(d()).rembourse, 40000, 'positif : la progression existe');
    const src = lireSource('assets/app.js');
    vrai(/Le capital emprunté au départ est déclaré à zéro alors qu’il reste une dette/
      .test(src), 'et la carte nomme le cas');
  });

  test('une mensualité et un apport absents ne valent pas zéro', () => {
    pret({ taux: 2 });
    eq(estDeclare(d().mensualite), false, 'mensualité absente');
    pres(mensualiteCredit(d()), 0, 'le calcul la traite comme rien, sans la déclarer nulle');
    pret({ taux: 2, mensualite: 0 });
    eq(num(d().mensualite), 0, 'une mensualité déclarée nulle reste zéro');

    /* L'apport suit la meme convention, et elle est deja verrouillee. */
    delete compteById('c_b').apport;
    eq(apportDeclare(compteById('c_b')), null, 'apport absent');
    compteById('c_b').apport = 0;
    eq(apportDeclare(compteById('c_b')), 0, 'apport nul déclaré');
    /* Et les trois montants de l'acquisition aussi. */
    const l = compteById('c_b').lignes[0];
    delete l.travauxInitiaux;
    eq(acquisitionLigne(l).travaux, null, 'travaux absents');
    l.travauxInitiaux = 0;
    eq(acquisitionLigne(l).travaux, 0, 'travaux déclarés nuls');
    delete l.fraisAcquisition;
    eq(acquisitionLigne(l).frais, null, 'frais absents');
    l.fraisAcquisition = 0;
    eq(acquisitionLigne(l).frais, 0, 'frais déclarés nuls');
  });
});

/* « 150 % » devenait 100 % en silence. C'est faux, et ca donne a croire que la
   saisie a ete prise en compte. */
suite('Une quote-part impossible ne s’enregistre plus', () => {

  const bien = (part) => Fixture.poser(s => {
    s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: [{ id: 'd1', libelle: 'Prêt',
      montant: 120000, initial: 150000, taux: 2, mensualite: 700, bienId: 'c_b' }] }];
    s.comptes = [{ id: 'c_b', etabId: 'e_bq', type: 'immo', statut: 'ouvert',
      libelle: 'Appartement', cash: [],
      lignes: [{ id: 'l0', classe: 'immobilier', libelle: 'Appartement', valeur: 400000,
        prixAchat: 350000, fraisAcquisition: 28000, travauxInitiaux: 0,
        usage: 'principale', ...(part === undefined ? {} : { part }) }] }];
    s.positions = []; s.monthly = [];
    s.budget.income = []; s.budget.fixedCharges = [];
  });

  test('les quatre valeurs valides, et les trois qui ne le sont pas', () => {
    for (const [p, attendu, quoi] of [
      [undefined, 1, 'vide vaut le tout'], [0, 0, 'zéro vaut zéro'],
      [50, 0.5, 'la moitié'], [100, 1, 'le tout'],
    ]) {
      bien(p);
      pres(partDetention(compteById('c_b').lignes[0]), attendu, quoi);
      eq(partEstValide(p), true, `${quoi} : et la valeur est valide`);
    }
    for (const p of [-1, -20, 101, 150]) {
      eq(partEstValide(p), false, `${p} % est refusée`);
    }
    eq(partEstValide(undefined), true, 'une part absente reste valide : elle vaut le tout');
    eq(partEstValide(''), true, 'un champ vide aussi');
  });

  test('l’écriture refuse une valeur hors bornes, et le mot dit la règle', () => {
    const src = lireSource('assets/app.js');
    /* `applyField` est le seul endroit ou tous les champs a chemin passent :
       la garde n'a donc pas besoin d'etre repetee. */
    vrai(/if \(\/\\\.part\$\/\.test\(path\) && f\.value !== '' && !partEstValide\(f\.value\)\)/
      .test(src), 'l’écriture refuse une quote-part hors bornes');
    vrai(/f\.dataset\.invalide = '1';\n\s*f\.setAttribute\('aria-invalid', 'true'\);\n\s*return;/
      .test(src), 'et rien n’entre dans les données, l’écran le disant aussi');
    vrai(/f\.removeAttribute\('aria-invalid'\)/.test(src),
      'l’état invalide part dès qu’une valeur correcte est saisie');
    /* Le wording ne parle plus de ce que le calcul ferait. */
    vrai(/La quote-part doit être comprise entre 0 et 100 %\./.test(src), 'le mot dit la règle');
    vrai(!/Au-delà, le bien compte en entier/.test(src),
      'et l’ancien wording, qui laissait croire que la saisie comptait, est parti');
  });

  test('une donnée ancienne invalide se signale, et ne se migre pas', () => {
    /* Personne ne sait si « 150 » voulait dire 15, 100 ou autre chose : choisir
       a la place du detenteur ecrirait une valeur inventee. */
    bien(150);
    const dits = healthChecks().filter(x => /Quote-part à corriger/.test(x.title || ''));
    eq(dits.length, 1, 'le contrôle la relève');
    vrai(/n’est pas une quote-part valide/.test(dits[0].detail || ''),
      'et nomme la valeur fautive');
    vrai(/pas inclus dans les montants personnels/.test(dits[0].detail || ''),
      'en disant ce qui est écarté');
    vrai(!/compte en entier dans ton patrimoine/.test(dits[0].detail || ''),
      'et non plus qu’il compte en entier');
    eq(num(compteById('c_b').lignes[0].part), 150, 'et la donnée n’est pas migrée');
    /* Le calcul reste possible entre-temps, et le garde-fou ne pretend rien. */
    eq(partDetention(compteById('c_b').lignes[0]), null,
      'la quote-part n’a plus de valeur : elle est invalide');
    /* La donnee reste telle quelle, aucune migration ne la reecrit, et le bien
       sort des montants personnels au lieu d'y entrer a cent pour cent. */
    eq(num(compteById('c_b').lignes[0].part), 150, 'la donnée n’est pas retouchée');
    vrai(Number.isFinite(patrimoine().brut), 'le patrimoine reste calculable');
    vrai(round2(patrimoine().brut) !== 400000,
      'et le bien n’est plus valorisé comme une détention à cent pour cent');
    eq(lotsPartInvalide().length, 1, 'le lot est nommément écarté');
    const st = lireSource('assets/store.js');
    vrai(!/\.part\s*=\s*(1|100)\b/.test(st), 'et rien n’écrit une part corrigée');
    /* Une valeur valide ne declenche rien. */
    bien(50);
    eq(healthChecks().filter(x => /Quote-part à corriger/.test(x.title || '')).length, 0,
      'une part valide ne dit rien');
  });

  test('la dette ne se divise jamais par la quote-part, la valeur et le coût si', () => {
    bien(50);
    pres(round2(patrimoine().brut), 200000, 'la moitié de la valeur entre au patrimoine');
    pres(round2(dettesTotal()), 120000, 'la dette reste entière : elle est due telle quelle');
    pres(round2(patrimoine().net), 80000, 'donc deux cent mille moins cent vingt mille');
    const l = lignesDe(compteById('c_b'))[0];
    pres(l.valeur, 200000, 'la ligne porte la moitié de la valeur');
    pres(l.prixDeRevient, 189000, 'et la moitié du coût, la même quote-part des deux côtés');
    pres(acquisitionCompte(compteById('c_b')).entier, 378000, 'le coût entier reste entier');
    pres(acquisitionCompte(compteById('c_b')).detenu, 189000, 'et la part détenue en est la moitié');
  });
});

/* D.1 ne change ni ce que vaut un patrimoine, ni ce que coute un mois. */
suite('D.1 ne change ni le patrimoine, ni les dettes, ni le Budget', () => {

  const poser = () => Fixture.poser(s => {
    s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: [{ id: 'd1', libelle: 'Prêt',
      montant: 187000, initial: 240000, taux: 2.8, mensualite: 1180,
      tauxAssurance: 0.3, bienId: 'c_b' }] }];
    s.comptes = [{ id: 'c_b', etabId: 'e_bq', type: 'immo', statut: 'ouvert',
      libelle: 'Appartement', cash: [], apport: 80000,
      lignes: [{ id: 'l0', classe: 'immobilier', libelle: 'Appartement', valeur: 370000,
        usage: 'principale', prixDeRevient: 334000 }] }];
    s.positions = []; s.monthly = [];
    s.budget.income = [];
    s.budget.fixedCharges = [{ label: 'Mensualité', amount: 1180, period: 'mois',
                               shares: {}, creditId: 'd1', bienId: 'c_b' },
                             { label: 'Taxe foncière', amount: 250, period: 'mois',
                               shares: {}, bienId: 'c_b' }];
  });

  test('un bien legacy garde exactement les mêmes totaux qu’avant D.1', () => {
    poser();
    pres(round2(patrimoine().brut), 370000, 'le patrimoine brut');
    pres(round2(dettesTotal()), 187000, 'les dettes');
    pres(round2(patrimoine().net), 183000, 'et le net');
    pres(round2(budgetFrame().fixed), 1430, 'le budget, une mensualité et une taxe');
    pres(round2(coutBien(compteById('c_b')).totalSorties), 1430,
      'et la mensualité ne se dédouble pas');
    pres(cashFlowBien(compteById('c_b')).base, 334000, 'la base reste le total legacy');
  });

  test('les fondations d’A, B, C et D tiennent', () => {
    poser();
    eq(Store.state.etabs[0].dettes[0].bienId, 'c_b', 'A : le crédit désigne son bien');
    eq(creditsAClarifier().length, 0, 'A : aucune référence à clarifier');
    eq(usageEffectifBien(compteById('c_b')).source, 'declare', 'B : l’usage est déclaré');
    const src = lireSource('assets/app.js');
    vrai(/if \(!estBienEnDirect\(c\)\) return cartePierrePapier\(c, idx, cf\);/.test(src),
      'C : la pierre papier garde sa fiche');
    vrai(/const pruAvant = num\(p\.buyPrice\) \|\| num\(base\);/.test(lireSource('assets/store.js')),
      'le PRU ne se dilue toujours pas par un zéro');
    const st = lireSource('assets/store.js');
    vrai(/if \(!estBienEnDirect\(compte\)\) return FRAIS_PIERRE_PAPIER;/.test(st),
      'C.2 : et ses frais');
    vrai(/Math\.abs\(plan\.ecart\) > 1/.test(st), 'D : la tolérance vaut toujours un euro');
    /* Le capital rembourse n'est toujours pas du cash. */
    vrai(!/capitalMois \+ [^;]*cashFlow|cashFlow \+ [^;]*capitalMois/.test(src),
      'et le capital remboursé ne rejoint aucun cash-flow');
  });
});

/* 150 % devenait 100 % : le calcul disait une detention que personne n'avait
   declaree, au moment meme ou l'ecran demandait de corriger la valeur. */
suite('Une quote-part invalide n’a pas de valeur, et n’en reçoit pas', () => {

  const bien = (part) => Fixture.poser(s => {
    s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: [{ id: 'd1', libelle: 'Prêt',
      montant: 120000, initial: 150000, taux: 2, mensualite: 700, bienId: 'c_b' }] }];
    s.comptes = [{ id: 'c_b', etabId: 'e_bq', type: 'immo', statut: 'ouvert',
      libelle: 'Appartement Paris', cash: [],
      lignes: [{ id: 'l0', classe: 'immobilier', libelle: 'Appartement Paris', valeur: 400000,
        prixAchat: 350000, fraisAcquisition: 28000, travauxInitiaux: 0,
        usage: 'principale', ...(part === undefined ? {} : { part }) }] }];
    s.positions = []; s.monthly = [];
    s.budget.income = []; s.budget.fixedCharges = [];
  });

  test('les quatre valeurs valides gardent exactement leur multiplicateur', () => {
    for (const [p, attendu, quoi] of [
      [undefined, 1, 'vide vaut le tout'], [0, 0, 'zéro vaut zéro'],
      [50, 0.5, 'la moitié'], [100, 1, 'le tout'],
    ]) {
      bien(p);
      pres(partDetention(compteById('c_b').lignes[0]), attendu, quoi);
    }
  });

  test('hors bornes ne rend ni 1, ni 0, ni un pourcentage inventé', () => {
    for (const p of [150, -10, 101, -0.5]) {
      bien(p);
      const q = partDetention(compteById('c_b').lignes[0]);
      eq(q, null, `${p} % : aucune valeur`);
      vrai(q !== 1, `${p} % ne devient pas le bien entier`);
      vrai(q !== 0, `${p} % ne devient pas zéro`);
      vrai(q !== p / 100, `${p} % ne se lit pas tel quel non plus`);
    }
    /* Et l'etat est explicite, pas devine par l'appelant. */
    bien(150);
    eq(partEstValide(150), false, 'la validité se lit à part');
    eq(lotsPartInvalide().length, 1, 'et le lot fautif se nomme');
    eq(lotsPartInvalide()[0].compte.id, 'c_b', 'avec son compte');
  });

  test('un bien à 150 % n’est jamais valorisé comme une détention à 100 %', () => {
    bien(100);
    const entier = round2(patrimoine().brut);
    pres(entier, 400000, 'à cent pour cent, le bien entier entre au patrimoine');

    bien(150);
    vrai(round2(patrimoine().brut) !== entier,
      'à cent cinquante, il n’entre plus pour la même chose');
    pres(round2(patrimoine().brut), 0, 'il sort des montants personnels');
    /* La ligne le dit, pour que la fiche puisse l'expliquer. */
    const l = lignesDe(compteById('c_b'))[0];
    eq(l.partInvalide, true, 'la ligne porte le cas');
    pres(l.valeurEntiere, 400000, 'et la valeur du bien entier reste lisible');
    pres(l.valeur, 0, 'seule la part détenue manque');
    /* Le cout d'acquisition detenu manque aussi, l'entier reste. */
    const acq = acquisitionCompte(compteById('c_b'));
    pres(acq.entier, 378000, 'le coût du bien entier reste connu');
    pres(acq.detenu, 0, 'mais la part détenue ne se calcule pas');
    eq(acq.partInvalide, true, 'et le compte le dit');
  });

  test('la donnée n’est pas migrée, et le contrôle dit ce qui est écarté', () => {
    bien(150);
    eq(num(compteById('c_b').lignes[0].part), 150, 'la valeur reste telle quelle');
    refreshAccounts();
    eq(num(compteById('c_b').lignes[0].part), 150, 'après un recalcul aussi');
    const st = lireSource('assets/store.js');
    vrai(!/\.part\s*=\s*(1|100)\b/.test(st), 'rien n’écrit une part corrigée');

    const dits = healthChecks().filter(x => /Quote-part à corriger/.test(x.title || ''));
    eq(dits.length, 1, 'le contrôle parle');
    eq(dits[0].level, 'warn', 'en avertissement');
    vrai(/150/.test(dits[0].detail || ''), 'il nomme la valeur fautive');
    vrai(/pas inclus dans les montants personnels/.test(dits[0].detail || ''),
      'et dit ce qui est écarté');
    vrai(!/compte en entier dans ton patrimoine/.test(dits[0].detail || ''),
      'l’ancien wording, qui prétendait le contraire, est parti');
    vrai(!/compte en entier dans ton patrimoine/.test(lireSource('assets/i18n.js')),
      'et sa clef aussi');
  });

  test('la dette n’est toujours pas multipliée par la quote-part', () => {
    bien(50);
    pres(round2(patrimoine().brut), 200000, 'la moitié de la valeur');
    pres(round2(dettesTotal()), 120000, 'la dette entière, telle qu’elle est due');
    pres(round2(patrimoine().net), 80000, 'donc deux cent mille moins cent vingt mille');
    /* Et à 150 %, la dette ne bouge pas non plus : c'est la part qui manque. */
    bien(150);
    pres(round2(dettesTotal()), 120000, 'une part invalide ne touche pas la dette');
  });
});

/* Refuser l'ecriture ne suffisait pas : la fiche s'enregistrait quand meme, et
   le detenteur repartait en croyant avoir saisi 150 %. */
suite('Une saisie invalide bloque vraiment l’enregistrement de la fiche', () => {

  const src = () => lireSource('assets/app.js');

  test('« Enregistrer » cherche un champ invalide avant toute écriture', () => {
    const s = src();
    const i = s.indexOf("'enregistrer-fiche'(btn)");
    vrai(i > 0, 'l’action doit être trouvable');
    const fn = s.slice(i, s.indexOf('\n  },', i));
    /* L'ordre compte : le blur d'abord, parce qu'il fait passer la derniere
       frappe par `applyField` — donc par la garde. */
    const blur = fn.indexOf('document.activeElement.blur()');
    const garde = fn.indexOf("const invalide = $('[data-invalide=\"1\"]');");
    const save = fn.indexOf('Store.save();');
    vrai(blur > 0 && garde > blur, 'la garde vient après le blur');
    vrai(save > garde, 'et avant tout enregistrement');
    vrai(/if \(invalide\) \{[\s\S]{0,220}return;/.test(fn),
      'un champ invalide arrête le geste');
    vrai(/invalide\.focus\(\);/.test(fn), 'le curseur revient sur lui');
    vrai(/La quote-part doit être comprise entre 0 et 100 %\./.test(fn),
      'et le message dit la règle');
  });

  test('la valeur invalide reste visible, et l’état s’efface dès la correction', () => {
    const s = src();
    /* `applyField` ne reecrit jamais le champ : il refuse d'ecrire dans l'etat
       et marque le champ. La saisie reste donc a l'ecran, avec son message. */
    vrai(/f\.dataset\.invalide = '1';\n\s*f\.setAttribute\('aria-invalid', 'true'\);\n\s*return;/
      .test(s), 'la valeur n’entre pas dans les données, et l’écran le dit');
    /* La borne haute est la fonction SUIVANTE, jamais une longueur : une
       fenetre en caracteres se defait des que les commentaires partent, et
       l'arbre publie n'en a aucun. */
    const i = s.indexOf('function applyField');
    /* `applyField` est la derniere fonction du fichier : la borne haute est le
       demarrage, qui est du CODE et survit donc au filtre de publication. */
    const fn = s.slice(i, s.indexOf('(async function init()', i));
    vrai(fn.length > 200, 'applyField doit être trouvable');
    vrai(/setPath\(path, f\.value\)/.test(fn), 'et être bien la bonne fonction');
    /* `(?!=)` : sans lui le motif attrape `f.value === ''`, une comparaison, et
       croit voir une affectation. */
    vrai(!/f\.value\s*=(?!=)/.test(fn),
      'et rien ne réécrit le champ à la place du détenteur');
    vrai(/delete f\.dataset\.invalide;\n\s*f\.removeAttribute\('aria-invalid'\);/.test(s),
      'une valeur correcte efface l’état invalide');
  });

  test('« Annuler » reste possible, et restaure l’état précédent', () => {
    const s = src();
    const i = s.indexOf("async 'annuler-fiche'(btn)");
    vrai(i > 0, 'l’action doit exister');
    const fn = s.slice(i, s.indexOf('\n  },', i));
    vrai(/retablirFiche\(\);/.test(fn), 'elle rétablit l’instantané');
    vrai(!/data-invalide/.test(fn),
      'et ne regarde aucun champ invalide : on n’oblige personne à corriger pour abandonner');
  });

  test('aucune autre sortie de la fiche n’écrit derrière la garde', () => {
    /* Le contrôle qui compte : `Store.save()` dans la fiche passe par
       « Enregistrer », et par lui seul. */
    const s = src();
    const i = s.indexOf("'enregistrer-fiche'(btn)");
    const fn = s.slice(i, s.indexOf('\n  },', i));
    eq((fn.match(/Store\.save\(\)/g) || []).length, 1,
      'un seul enregistrement dans l’action, après la garde');
    /* Et le champ de la part porte bien ses bornes côté navigateur aussi. */
    vrai(/min="0" max="100"/.test(s), 'le champ déclare ses bornes');
  });
});

/* Le `&& > 0` survivait sur le seul chemin de la creation d'un bien : un zero
   declare y redevenait « absent ». */
suite('Un capital emprunté nul reste nul dans l’onboarding', () => {

  const parcours = () => {
    const s = lireSource('assets/app.js');
    return s.slice(s.indexOf("async 'ajouter-compte'"), s.indexOf("'fiche-compte'(btn)"));
  };

  test('vide, zéro et positif sont trois écritures distinctes', () => {
    const p = parcours();
    vrai(/initial: estDeclare\(e3\.initial\) \? num\(e3\.initial\) : null/.test(p),
      'le zéro déclaré s’écrit, l’absence reste nulle');
    vrai(!/estDeclare\(e3\.initial\) && num\(e3\.initial\) > 0/.test(p),
      'et le seuil qui effaçait le zéro est parti');
    /* Et le champ reste FACULTATIF : absent veut dire qu'on ne le connait pas. */
    vrai(!/cle: 'initial'[^}]*requis/.test(p), 'il n’est pas obligatoire');
  });

  test('un champ nombre vide franchit le formulaire sans devenir un zéro', () => {
    /* LE DEFAUT ETAIT EN AMONT DE TOUT LE RESTE. `valeurs()` rendait
       `num(el.value)` pour un champ nombre, et `num('')` vaut zero : un champ
       traverse sans rien taper arrivait chez l'appelant comme un ZERO DECLARE.

       Consequence exacte : tous les `estDeclare(v.x)` poses sur les champs de
       credit lisaient vrai sur du vide, et ecrivaient 0 la ou il fallait `null`.
       La convention « vide n'est pas zero » tombait avant meme d'atteindre le
       code qui la respecte, et aucun des correctifs precedents ne pouvait
       fonctionner a travers une fenetre. */
    const src = lireSource('assets/app.js');
    vrai(/: c\.type === 'nombre' \? \(el\.value === '' \? '' : num\(el\.value\)\)/.test(src),
      'un champ nombre vide rend la chaîne vide, pas zéro');
    vrai(!/: c\.type === 'nombre' \? num\(el\.value\)\n/.test(src),
      'et l’ancienne lecture, qui les confondait, est partie');
    /* Les deux lecteurs en aval continuent de fonctionner : `vide()` compte deja
       la chaine vide comme vide, et `num('')` vaut toujours zero. */
    eq(estDeclare(''), false, 'une chaîne vide n’est pas déclarée');
    eq(estDeclare(0), true, 'zéro l’est');
    pres(num(''), 0, 'et num() la lit toujours comme zéro');
    vrai(/if \(c\.type === 'nombre'\) return !num\(v\);/.test(src),
      'la garde des champs obligatoires ne change pas');
  });

  test('un capital emprunté nul avec une dette est refusé, pas effacé', () => {
    const p = parcours();
    /* La regle a quitte l'expression flechee d'une ligne pour un corps : elles
       sont plusieurs desormais, et la premiere qui parle rend la main. */
    vrai(/v\.aCredit === 'oui' && !\(num\(v\.credit\) > 0\)/.test(p),
      'la règle regarde les deux champs à la fois');
    /* Le zero du capital emprunte se juge desormais dans la regle centrale des
       credits, celle que partagent les trois portes de saisie. La creation la
       nomme, elle ne la recopie pas. */
    vrai(/validerCreditSaisi\(v, \{ montant: 'credit' \}\)/.test(p),
      'et elle délègue le crédit à la règle centrale');
    const store = lireSource('assets/store.js');
    vrai(/Le capital emprunté au départ doit être /.test(store), 'le message dit pourquoi');
    /* La phrase entiere vit dans le dictionnaire : c'est elle qui s'affiche, et
       la source la coupe en deux par concatenation. */
    vrai(I18N.en['Le capital emprunté au départ doit être supérieur à 0 lorsqu’un capital '
      + 'restant dû est renseigné.'], 'et elle a sa traduction');
    const zero = validerCreditSaisi({ credit: 120000, initial: 0 }, { montant: 'credit' });
    vrai(zero && zero.cle === 'initial', 'et le curseur revient sur le bon champ');
    /* Un capital ABSENT avec une dette reste autorise : c'est une inconnue. */
    eq(validerCreditSaisi({ credit: 120000 }, { montant: 'credit' }), null,
      'absent, il reste une inconnue');
    const s = lireSource('assets/app.js');
    vrai(/const souci = efface \? null : valide\?\.\(out\);/.test(s),
      'la fenêtre lit la règle croisée');
    vrai(/if \(souci\) \{[\s\S]{0,200}return;/.test(s),
      'et reste ouverte quand elle parle');
  });

  test('répondre « non » ne lit aucune valeur de crédit', () => {
    const s = lireSource('assets/app.js');
    vrai(/if \(!el \|\| el\.closest\('\.field'\)\?\.hidden\) continue;/.test(s),
      'un champ masqué ne se lit pas');
    const p = parcours();
    for (const cle of ['credit', 'initial', 'preteur', 'mensualite', 'taux',
                       'tauxAssurance', 'charge']) {
      vrai(new RegExp(`cle: '${cle}'[\\s\\S]{0,220}montreSi: avecCredit`).test(p),
        `« ${cle} » est masqué quand la réponse est non`);
    }
    vrai(/if \(num\(e3\.credit\)\) \{/.test(p), 'et sans capital restant, aucun crédit n’est créé');
  });

  test('les zéros déclarés des autres champs de crédit tiennent toujours', () => {
    Fixture.poser(s => {
      s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: [{ id: 'd1', libelle: 'Prêt',
        montant: 200000, initial: 240000, taux: 0, tauxAssurance: 0, mensualite: 0,
        bienId: 'c_b' }] }];
      s.comptes = [{ id: 'c_b', etabId: 'e_bq', type: 'immo', statut: 'ouvert',
        libelle: 'Appartement', cash: [],
        lignes: [{ id: 'l0', classe: 'immobilier', libelle: 'Appartement', valeur: 370000,
                   usage: 'principale', prixAchat: 300000 }] }];
      s.positions = []; s.monthly = [];
      s.budget.income = []; s.budget.fixedCharges = [];
    });
    const d = Store.state.etabs[0].dettes[0];
    eq(tauxCreditDeclare(d), 0, 'un taux à zéro reste zéro');
    eq(num(d.tauxAssurance), 0, 'un taux d’assurance à zéro aussi');
    eq(estDeclare(d.tauxAssurance), true, 'et il est bien déclaré');
    eq(num(d.mensualite), 0, 'une mensualité déclarée nulle reste zéro');
    d.mensualite = null;
    eq(estDeclare(d.mensualite), false, 'là où une mensualité absente reste absente');
  });
});

/* D.2 ne change rien pour une donnee valide. */
suite('D.2 ne change rien aux données valides', () => {

  const poser = (part) => Fixture.poser(s => {
    s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: [{ id: 'd1', libelle: 'Prêt',
      montant: 187000, initial: 240000, taux: 2.8, mensualite: 1180,
      tauxAssurance: 0.3, bienId: 'c_b' }] }];
    s.comptes = [{ id: 'c_b', etabId: 'e_bq', type: 'immo', statut: 'ouvert',
      libelle: 'Appartement', cash: [], apport: 80000,
      lignes: [{ id: 'l0', classe: 'immobilier', libelle: 'Appartement', valeur: 370000,
        usage: 'principale', prixDeRevient: 334000,
        ...(part === undefined ? {} : { part }) }] }];
    s.positions = []; s.monthly = [];
    s.budget.income = [];
    s.budget.fixedCharges = [{ label: 'Mensualité', amount: 1180, period: 'mois',
                               shares: {}, creditId: 'd1', bienId: 'c_b' },
                             { label: 'Taxe foncière', amount: 250, period: 'mois',
                               shares: {}, bienId: 'c_b' }];
  });

  test('sans quote-part, tous les totaux sont ceux d’avant D.2', () => {
    poser();
    pres(round2(patrimoine().brut), 370000, 'le patrimoine brut');
    pres(round2(dettesTotal()), 187000, 'les dettes');
    pres(round2(patrimoine().net), 183000, 'le net');
    pres(round2(budgetFrame().fixed), 1430, 'le budget');
    pres(round2(coutBien(compteById('c_b')).totalSorties), 1430,
      'et la mensualité ne se dédouble pas');
    pres(cashFlowBien(compteById('c_b')).base, 334000, 'la base d’acquisition');
  });

  test('à cinquante pour cent, les calculs sont ceux d’avant aussi', () => {
    poser(50);
    pres(round2(patrimoine().brut), 185000, 'la moitié de la valeur');
    pres(round2(dettesTotal()), 187000, 'la dette entière');
    pres(round2(budgetFrame().fixed), 1430, 'le budget ne dépend pas de la part');
    pres(lignesDe(compteById('c_b'))[0].prixDeRevient, 167000, 'et la moitié du coût');
    eq(lignesDe(compteById('c_b'))[0].partInvalide, false, 'rien d’invalide ici');
  });

  test('les fondations d’A, B, C et D tiennent', () => {
    poser(50);
    eq(Store.state.etabs[0].dettes[0].bienId, 'c_b', 'A : le crédit désigne son bien');
    eq(creditsAClarifier().length, 0, 'A : aucune référence à clarifier');
    eq(usageEffectifBien(compteById('c_b')).source, 'declare', 'B : l’usage est déclaré');
    const src = lireSource('assets/app.js');
    const st = lireSource('assets/store.js');
    vrai(/if \(!estBienEnDirect\(c\)\) return cartePierrePapier\(c, idx, cf\);/.test(src),
      'C : la pierre papier garde sa fiche');
    vrai(/if \(!estBienEnDirect\(compte\)\) return FRAIS_PIERRE_PAPIER;/.test(st),
      'C.2 : et ses frais');
    vrai(/const pruAvant = num\(p\.buyPrice\) \|\| num\(base\);/.test(lireSource('assets/store.js')),
      'le PRU ne se dilue pas par un zéro');
    vrai(/Math\.abs\(plan\.ecart\) > 1/.test(st), 'D : la tolérance vaut un euro');
    vrai(/if \(complet\)\n\s*return \{ \.\.\.socle, total: sousTotal, source: 'detail', complet: true \};/
      .test(st), 'D.1 : le détail ne prend la main que complet');
    vrai(!/capitalMois \+ [^;]*cashFlow|cashFlow \+ [^;]*capitalMois/.test(src),
      'et le capital remboursé ne rejoint aucun cash-flow');
  });
});

/* P0.2 : UN CREDIT SE VALIDE A L'ENTREE, PAS A LA LECTURE. Un capital restant du
   negatif s'additionne en negatif dans le patrimoine net : il ENRICHIT, et le
   total penche du bon cote, donc rien ne le trahit. Un plancher a zero dans le
   total cacherait la saisie au lieu de l'empecher. */
suite('Un capital restant dû négatif ne peut plus se saisir', () => {

  test('la règle refuse un capital restant dû négatif, et nomme le champ', () => {
    const f = validerCreditSaisi({ montant: -1000 });
    vrai(f, 'la saisie est refusée');
    eq(f.cle, 'montant', 'et c’est ce champ-là que la fenêtre désigne');
    vrai(/négatif/.test(f.message), `le message dit pourquoi : « ${f.message} »`);
  });

  test('elle laisse passer ce qui est honnête', () => {
    eq(validerCreditSaisi({}), null, 'un crédit dont rien n’est renseigné');
    eq(validerCreditSaisi({ montant: 0 }), null, 'un prêt soldé vaut zéro, pas une faute');
    eq(validerCreditSaisi({ montant: 120000, initial: 150000, mensualite: 800,
                            taux: 0, tauxAssurance: 0 }), null,
      'et un prêt à 0 % reste une déclaration, pas une absence');
  });

  test('aucun des cinq montants ne passe en négatif', () => {
    for (const cle of ['montant', 'initial', 'mensualite', 'taux', 'tauxAssurance']) {
      const f = validerCreditSaisi({ montant: 1000, [cle]: -1 });
      vrai(f, `« ${cle} » à −1 doit être refusé`);
      eq(f.cle, cle, `et la fenêtre doit désigner « ${cle} »`);
    }
  });

  test('un capital emprunté à zéro face à un restant dû', () => {
    const f = validerCreditSaisi({ montant: 120000, initial: 0 });
    vrai(f && f.cle === 'initial', 'le second ne peut pas venir du premier');
    eq(validerCreditSaisi({ montant: 120000 }), null,
      'mais le champ reste facultatif : un vieux prêt dont on a oublié le départ s’en passe');
  });

  test('la table des clefs suit la porte qui appelle', () => {
    /* La creation d'un bien nomme `credit` ce que les deux autres portes
       nomment `montant`. Une regle recopiee a trois endroits finit par diverger :
       c'est donc la clef qui voyage, jamais la regle. */
    const f = validerCreditSaisi({ credit: -1 }, { montant: 'credit' });
    vrai(f, 'refusé sous son autre nom aussi');
    eq(f.cle, 'credit', 'et la fenêtre désigne le champ qui existe chez elle');
    eq(validerCreditSaisi({ montant: -1 }, { montant: 'credit' }), null,
      'sans lire un champ que cette fenêtre-là n’a pas');
  });

  test('les trois portes appellent la règle, aucune ne la recopie', () => {
    /* Sur le CODE, jamais sur un commentaire : un controle ancre sur de la prose
       passe ici et rougit sur l'arbre publie, ou les commentaires sont retires. */
    const code = lireSource('assets/app.js').replace(/\/\*[\s\S]*?\*\//g, ' ');
    const entre = (nom, fin) => {
      const d = code.indexOf(nom);
      vrai(d > 0, `la porte « ${nom} » doit exister`);
      const f = code.indexOf(fin, d);
      return code.slice(d, f > d ? f : d + 8000);
    };
    vrai(/validerCreditSaisi\(/.test(entre("async 'ajouter-credit'", "async 'editer-credit'")),
      'l’ajout depuis un établissement ne valide pas sa saisie');
    vrai(/validerCreditSaisi\(/.test(entre("async 'editer-credit'", "async 'retirer-credit'")),
      'l’édition d’un crédit ne valide pas sa saisie');
    vrai(/validerCreditSaisi\(v, \{ montant: 'credit' \}\)/.test(code),
      'la création d’un bien financé passe par la même règle');
    /* Et la regle vit dans le modele, la ou elle se teste. */
    vrai(/function validerCreditSaisi\(/.test(lireSource('assets/store.js')),
      'la règle appartient au modèle, pas à une fenêtre');
  });

  test('le total des dettes n’est pas rafistolé à la lecture', () => {
    const total = corpsDe(lireSource('assets/store.js'), 'dettesTotal');
    vrai(/reduce/.test(total), 'le total se lit bien ici');
    vrai(!/Math\.max/.test(total),
      'le total somme ce qui est écrit : le redresser cacherait la saisie fautive '
      + 'au lieu de l’empêcher, et l’export l’emporterait quand même');
  });

  test('un état déjà écrit se signale au lieu de se corriger tout seul', () => {
    /* Personne ne peut savoir si « −12 000 » voulait dire 12 000 ou zero :
       choisir a la place du detenteur ecrirait un chiffre invente. */
    Fixture.poser(e => {
      e.etabs.find(x => (x.dettes || []).length).dettes[0].montant = -12000;
    });
    pres(dettesTotal(), -12000, 'le total dit la vérité, aussi fausse soit-elle');
    const ligne = healthChecks().find(h => /Capital restant dû invalide/.test(h.title));
    vrai(ligne, 'la cloche le signale');
    eq(ligne.level, 'error', 'comme une erreur, pas comme un avis');
    eq(ligne.view, 'accounts', 'avec la porte pour aller le corriger');
    Store.state.etabs.find(x => (x.dettes || []).length).dettes[0].montant = 12000;
    vrai(!healthChecks().some(h => /Capital restant dû invalide/.test(h.title)),
      'et il se tait dès que le signe est corrigé');
  });
});

/* P0.3 : UN ZERO DECLARE EST UN TAUX, PAS UNE ABSENCE. C'est deja la convention
   de l'echeancier et de la projection d'un credit ; la projection de patrimoine
   etait le dernier lecteur a confondre les deux, et elle laissait constant le
   pret le plus simple a amortir. */
suite('Un prêt à 0 % s’amortit dans la projection', () => {

  /* On remplace la dette du jeu d'essai, sans toucher aux etablissements : les
     comptes y sont rattaches, et les detacher fausserait tous les totaux. */
  const pretDe = champs => Fixture.poser(s => {
    const e = s.etabs.find(x => (x.dettes || []).length);
    e.dettes = [{ id: 'd0', libelle: 'Prêt familial', montant: 12000,
                  initial: 24000, ...champs }];
  });

  test('un taux déclaré à zéro entre dans les dettes amortissables', () => {
    pretDe({ taux: 0, mensualite: 500 });
    const l = dettesAmortissables();
    eq(l.length, 1, 'le prêt est amortissable : pas d’intérêts, tout en capital');
    pres(l[0].taux, 0, 'à taux zéro');
    pres(l[0].mens, 500, 'et la mensualité entière rembourse');
  });

  test('un taux absent reste une absence, et rien ne se projette', () => {
    /* La regle ne change pas : sans taux declare, on ne sait pas separer le
       capital des interets, et on ne devine pas. */
    pretDe({ mensualite: 500 });
    eq(dettesAmortissables().length, 0, 'aucune projection sur un taux inconnu');
    pretDe({ taux: null, mensualite: 500 });
    eq(dettesAmortissables().length, 0, 'un taux nul explicite ne vaut pas zéro');
    pretDe({ taux: '', mensualite: 500 });
    eq(dettesAmortissables().length, 0, 'ni un champ vide');
    pretDe({ taux: 0 });
    eq(dettesAmortissables().length, 0, 'et sans mensualité, rien ne rembourse');
  });

  test('les trois lecteurs d’un taux partagent la même porte', () => {
    /* `tauxCreditDeclare` distingue le zero de l'ignorance. Trois lecteurs le
       lisent : l'echeancier, la projection d'un credit, et la projection de
       patrimoine — la derniere a l'avoir appris. Le controle porte sur le CODE :
       les commentaires disparaissent de l'arbre publie. */
    const code = lireSource('assets/store.js').replace(/\/\*[\s\S]*?\*\//g, ' ');
    const corps = corpsDe(code, 'dettesAmortissables');
    vrai(corps.length > 100, 'la fonction doit se relire depuis sa source');
    vrai(/tauxCreditDeclare\(d\)/.test(corps),
      'la projection de patrimoine lit le taux par la porte commune');
    vrai(!/num\(d\.taux\)/.test(corps),
      'et non par un num() qui confondrait zéro et inconnu');
  });

  test('la dette descend vraiment, et la part plate monte avec', () => {
    /* La preuve par le moteur : 12 000 EUR a 0 %, rembourses 500 EUR par mois,
       s'eteignent en vingt-quatre mois. */
    pretDe({ taux: 0, mensualite: 500 });
    const un = moteurProjection(configProjection({ years: 1 })).final.plat;
    const deux = moteurProjection(configProjection({ years: 2 })).final.plat;
    const trois = moteurProjection(configProjection({ years: 3 })).final.plat;
    vrai(deux > un, `la part plate monte avec le temps, vu ${Math.round(un)} puis ${Math.round(deux)}`);
    pres(deux - un, 6000, 'de six mille euros la deuxième année, comme la première');
    pres(trois, deux,
      'puis plus rien : au vingt-quatrième mois la dette est éteinte');
  });

  test('un taux minuscule et un taux nul projettent la même chose', () => {
    /* Le defaut se mesure : 0,01 % passait, 0 % non, et l'ecart entre les deux
       projections etait de tout le capital rembourse. */
    pretDe({ taux: 0, mensualite: 500 });
    const zero = moteurProjection(configProjection({ years: 2 })).final.plat;
    pretDe({ taux: 0.01, mensualite: 500 });
    const presque = moteurProjection(configProjection({ years: 2 })).final.plat;
    vrai(Math.abs(zero - presque) < 50,
      `0 % et 0,01 % doivent projeter presque la même chose, vu ${Math.round(zero)} et ${Math.round(presque)}`);
  });
});

finDePartieDeTests('tests/19-frontiere-entre-pierre-papier.tests.js');
