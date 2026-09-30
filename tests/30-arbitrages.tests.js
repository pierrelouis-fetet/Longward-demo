partieDeTests('tests/30-arbitrages.tests.js');
/* ------------------------------------------------------------------
   Types et parcours : un PEL, l'epargne salariale, un compte joint, plusieurs
   prets chez une plateforme, une banque qui vend l'assurance-vie. Montants
   fictifs.
   ------------------------------------------------------------------ */
suite('Arbitrages : types et parcours', () => {
  const app = () => (lireSource('assets/app.js') || '').replace(/\/\*[\s\S]*?\*\//g, '');

  test('un PEL est de l’argent de projet, disponible en quelques jours, sans jauge de plafond', () => {
    const pel = typeCompte('pel');
    eq(pel.groupe, 'cash', 'des liquidités');
    eq(pel.defaut, 'projet', 'de l’argent de projet par défaut, donc hors de la réserve');
    eq(mobilisabilite('liquidites', 'pel'), 'differe', 'un retrait le clôt : quelques jours, pas l’immédiat');
    eq(resteAVerser({ type: 'pel', plafond: 61200, cash: [{ montant: 62000, affectation: 'projet' }] }), null,
      'le plafond borne les versements, que le modèle ne connaît pas : aucun reste chiffré');
    vrai(/61 200 €/.test(pel.retrait), 'le plafond se dit en toutes lettres');
    vrai(!!I18N.en[pel.label] && !!I18N.en[pel.retrait], 'et se traduit');
  });

  test('un PEE libère chaque versement à son tour, un PER et un PERECO à une seule date', () => {
    const pee = typeCompte('pee'), pereco = typeCompte('pereco'), per = typeCompte('per');
    for (const t of [pee, pereco]) {
      eq(t.disponibilite, 'bloque', `${t.id} est bloqué par défaut`);
      vrai(t.sansCash && t.melange, `${t.id} porte des fonds, pas de cash`);
      eq(rubriqueDuType(t), 'retraite', `${t.id} se range avec la retraite`);
      vrai(!!I18N.en[t.label] && !!I18N.en[t.retrait], `${t.id} se traduit`);
    }
    vrai(!pee.echeanceUnique, 'un PEE n’a pas une date pour tout le plan');
    vrai(pereco.echeanceUnique && per.echeanceUnique, 'un PER et un PERECO, si');
    enLangue('fr', () => {
      eq(motCompte(pee), 'plan', 'un PEE est un plan, chez un teneur de compte');
      eq(motCompte(pereco), 'plan', 'un PERECO aussi');
    });
    vrai(/impôt éventuel dû à la sortie, qui dépend de l’origine des sommes/.test(pereco.retrait),
      'la sortie d’un PERECO ne reprend pas mot pour mot celle d’un PER individuel');
  });

  test('un compte joint se saisit comme on le suit, et la consigne est aux deux endroits', () => {
    const cle = 'Un compte joint se saisit comme tu le suis : ta part si chacun tient son tableau de bord, le solde entier pour suivre le foyer.';
    const src = lireSource('assets/app.js') || '';
    eq((src.match(/Un compte joint se saisit comme tu le suis/g) || []).length, 2, 'dans l’assistant et sur la carte du solde');
    vrai(!!I18N.en[cle], 'et se traduit');
  });

  test('une banque propose une assurance-vie, jamais un bien ni une société', () => {
    Fixture.poser(s => {
      s.etabs.push({ id: 'e_assur', nom: 'Assureur', notes: '', dettes: [] },
                   { id: 'e_mixte', nom: 'Banque mixte', notes: '', dettes: [] },
                   { id: 'e_vide', nom: 'Vide', notes: '', dettes: [] });
      const compte = (id, etabId, type) => ({ id, etabId, type, statut: 'ouvert', ouvertLe: '', numero: '',
                                              notes: '', libelle: id, court: id, alloc: '', cash: [], lignes: [] });
      s.comptes.push(compte('c_av', 'e_assur', 'av'), compte('c_mx1', 'e_mixte', 'courant'),
                     compte('c_mx2', 'e_mixte', 'av'));
    });
    const ids = typeId => etablissementsProposables(typeId).map(x => x.etab.id);
    const pourAv = ids('av');
    eq(pourAv[0], 'e_assur', 'un assureur d’abord pour une assurance-vie');
    vrai(pourAv.includes('e_banque') && pourAv.includes('e_courtier') && pourAv.includes('e_mixte'),
      'puis les banques et courtiers, guichets compatibles');
    vrai(!pourAv.includes('e_bien') && !pourAv.includes('e_pe'), 'jamais un bien ni une plateforme');
    eq(pourAv[pourAv.length - 1], 'e_vide', 'le vide en dernier');
    vrai(etablissementsProposables('av').find(x => x.etab.id === 'e_vide').vide, 'et dit qu’il est vide');
    const pourImmo = ids('immo');
    vrai(pourImmo.includes('e_bien') && !pourImmo.includes('e_banque') && !pourImmo.includes('e_assur'),
      'un bien ne se range que chez un bien');
    /* Le couple final se controle dans « Modifier » : une plateforme qui porte
       une part de societe n'accepte pas un contrat. */
    Fixture.poser(s => s.comptes.push({ id: 'c_pe2', etabId: 'e_pe', type: 'pe', statut: 'ouvert', ouvertLe: '',
      numero: '', notes: '', libelle: 'Parts', court: 'Parts', alloc: '', cash: [], lignes: [] }));
    eq(etablissementAccepte('e_pe', 'av', 'c_pe'), false, 'une plateforme garde sa nature');
    eq(etablissementAccepte('e_pe', 'pe', 'c_pe'), true, 'et accepte ce qui lui ressemble');
    eq(etablissementAccepte('e_bien', 'av', 'c_immo'), true, 'un établissement dont on retype le seul compte change avec lui');
    vrai(/!etablissementAccepte\(etabFinal, v\.type \|\| c\.type, c\.id\)/.test(app()), 'et « Modifier » le vérifie');
    Fixture.poser();
    for (const id of ['pe', 'fondsNonCote', 'crowdfunding'])
      eq(contenantDuType(id), CONTENANTS.societe, `${id} se tient chez une société ou une plateforme`);
    vrai(/const compatibles = etablissementsProposables\(typeVise, c\.etabId\)/.test(app())
      && /const typeVise = saisi && saisi\.type && saisi\.type !== '__nouveau' \? saisi\.type : c\.type;/.test(app())
      && /const proposables = etablissementsProposables\(t\.id\)/.test(app()),
      'la même règle dans l’assistant et dans « Modifier »');
    Fixture.poser();
  });

  test('un fonds monétaire s’ajoute à un contrat comme une ligne, sans cash', () => {
    vrai(/const possibles = \(t\.classes \|\| \[\]\)\.filter\(x => x !== 'liquidites' \|\| t\.sansCash\);/.test(app()),
      'la classe se propose aux seuls contrats sans poche de cash');
    vrai(/const parDefaut = possibles\.find\(x => x !== 'liquidites'\)/.test(app()),
      'sans devenir le support proposé d’abord');
    Fixture.poser(s => s.comptes.push({ id: 'c_av', etabId: 'e_courtier', type: 'av', statut: 'ouvert', ouvertLe: '',
      numero: '', notes: '', libelle: 'AV', court: 'AV', alloc: '', cash: [],
      lignes: [{ id: 'l_mon', classe: 'liquidites', libelle: 'Fonds monétaire', valeur: 4000, quantite: 1 }] }));
    pres(liquiditesEnLignes(), 4000, 'il compte dans les liquidités, à part des espèces');
    eq((compteById('c_av').cash || []).length, 0, 'et le contrat ne gagne aucune part de cash');
    Fixture.poser();
  });

  test('un second prêt chez la même plateforme est un second compte, et il se nomme', () => {
    const src = app();
    vrai(/const placementTiers = estActifTerminal\(t\) && !estDetenuEnDirect\(t\);/.test(src),
      'l’assistant reconnaît un placement tenu par un tiers');
    vrai(/champs: placementTiers \? champsTiers : bien \? \[/.test(src), 'et lui donne la fenêtre d’un placement');
    vrai(/: ch\.cle === 'valeur' \? \{ \.\.\.ch, requis: true \} : ch\)/.test(src), 'dont la valeur se demande');
    vrai(/lignes\.push\(litPlacement\(e3, \{ id: 'l' \+ Date\.now\(\)\.toString\(36\), classe: classeDuBien \}, t\)\);/.test(src),
      'écrite comme « Placement dans… »');
    vrai(/ouvertLe: \(placementTiers \? e3\.dateAcquisition : e3\.ouvertLe\) \|\| ''/.test(src),
      'le compte prend la date d’entrée de sa ligne');
    vrai(/const e1 = typeFixe \? \{ type: typeFixe \} : await askForm\(/.test(src),
      'un type imposé avec son établissement ne se rechoisit pas');
    vrai(/data-action="ajouter-compte" data-etab="\$\{esc\(c\.etabId\)\}" data-type="\$\{esc\(c\.type\)\}" data-type-fixe="1"/.test(src),
      'et la carte d’un prêt ouvre ce raccourci');
    eq(I18N.en['Un autre prêt chez {e}'], 'Another loan at {e}', 'qui se traduit');
  });
});

finDePartieDeTests('tests/30-arbitrages.tests.js');
