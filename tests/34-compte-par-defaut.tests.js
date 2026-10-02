partieDeTests('tests/34-compte-par-defaut.tests.js');
/* ------------------------------------------------------------------
   Le compte ou s'ouvrent les nouvelles lignes de titres : le premier compte a
   titres, sauf si une case des fenetres d'ajout en designe un. Deux
   preferences, titres et crypto, une seule regle d'admissibilite.
   ------------------------------------------------------------------ */
suite('Compte par défaut des nouvelles lignes', () => {
  const app = () => (lireSource('assets/app.js') || '').replace(/\/\*[\s\S]*?\*\//g, '');
  /* Un portefeuille crypto en plus des comptes du fixture (PEA puis CTO). */
  const poser = modifier => Fixture.poser(s => {
    s.comptes.push({ id: 'c_crypto', etabId: 'e_courtier', type: 'crypto', statut: 'ouvert', ouvertLe: '2023-01-01',
                     numero: '', notes: '', libelle: 'Wallet', court: 'Wallet', alloc: '', cash: [], lignes: [] });
    if (modifier) modifier(s);
  });

  test('sans préférence, le premier compte à titres ; avec, le compte désigné', () => {
    poser();
    eq(compteParDefaut('actions'), null, 'aucune préférence');
    eq(defaultHoldingAccount(), 'c_pea', 'le premier compte à titres');
    vrai(poserCompteParDefaut('actions', 'c_cto', true), 'le CTO devient le compte par défaut');
    eq(compteParDefaut('actions'), 'c_cto', 'pour les actions');
    eq(defaultHoldingAccount(), 'c_cto', 'et la règle le préfère');
    vrai(poserCompteParDefaut('actions', 'c_cto', false), 'décocher sur le compte par défaut l’efface');
    vrai(!Store.state.meta.comptesParDefaut, 'sans laisser de préférence vide');
    eq(defaultHoldingAccount(), 'c_pea', 'et la règle automatique revient');
    vrai(!poserCompteParDefaut('actions', 'c_pea', false), 'décocher un autre compte ne change rien');
  });

  test('une crypto a sa propre préférence, et le CTO ne lui est jamais rendu', () => {
    poser();
    poserCompteParDefaut('actions', 'c_cto', true);
    eq(compteParDefaut('crypto'), null, 'le CTO ne porte pas de crypto');
    vrai(poserCompteParDefaut('crypto', 'c_crypto', true), 'le portefeuille devient le défaut des cryptos');
    eq(compteParDefaut('actions'), 'c_cto', 'sans toucher à celui des actions');
    eq(compteParDefaut('crypto'), 'c_crypto', 'chacun sa clef');
    vrai(!poserCompteParDefaut('crypto', 'c_cto', true), 'le CTO est refusé pour une crypto');
  });

  test('seul un compte ouvert qui porte des titres et accepte la classe peut l’être', () => {
    poser();
    vrai(!compteAdmissibleParDefaut('monetaire', 'c_courant'), 'un compte courant, non');
    vrai(!poserCompteParDefaut('monetaire', 'c_courant', true), 'et la case ne l’écrit pas');
    vrai(!compteAdmissibleParDefaut('actions', 'c_inconnu'), 'un compte qui n’existe pas, non');
    poser(s => { s.meta.comptesParDefaut = { titres: 'c_cto' }; s.comptes.find(c => c.id === 'c_cto').statut = 'archive'; });
    eq(compteParDefaut('actions'), null, 'une préférence vers un compte archivé ne se lit pas');
    eq(defaultHoldingAccount(), 'c_pea', 'la règle automatique la remplace');
  });

  test('archiver ou supprimer un compte efface sa préférence', () => {
    poser(s => { s.meta.comptesParDefaut = { titres: 'c_cto', crypto: 'c_crypto' }; });
    oublierCompteParDefaut('c_cto');
    eq(JSON.stringify(Store.state.meta.comptesParDefaut), JSON.stringify({ crypto: 'c_crypto' }), 'seule la sienne part');
    oublierCompteParDefaut('c_crypto');
    vrai(!Store.state.meta.comptesParDefaut, 'et la dernière emporte la clef');
    const modele = lireSource('assets/store.js') || '';
    vrai(/src\.statut = 'archive';\s*oublierCompteParDefaut\(src\.id\);/.test(modele), 'l’archivage par transfert l’appelle');
    vrai(/for \(const id of cibles\) oublierCompteParDefaut\(id\);/.test(modele), 'la suppression des comptes clos aussi');
    const src = app();
    vrai(/c\.statut = 'archive';\s*oublierCompteParDefaut\(c\.id\);/.test(src), 'l’archivage de la fenêtre aussi');
    vrai(/Store\.state\.comptes\.filter\(x => x\.id !== c\.id\);\s*oublierCompteParDefaut\(c\.id\);/.test(src),
      'et la suppression de la fiche');
  });

  test('les deux fenêtres partent d’un seul compte compatible, et portent la case', () => {
    const src = app();
    vrai(/return \[vise, compteParDefaut\(cat\)\]\.find\(id => id && ids\.includes\(id\)\) \|\| ids\[0\] \|\| '';/.test(src),
      'la visée, puis le compte par défaut, puis le premier compte compatible');
    vrai(/valeur: depart, aide: trad\('limité aux comptes compatibles'\)/.test(src)
      && /valeur: !contratSansCash\(depart\)/.test(src) && /comptesQuiPaient\(depart\), depart/.test(src),
      'le compte, la case du débit et la part qui paie partent du même compte');
    vrai(/options: comptesPourListe\('actions'\),\s*valeur: compteDeDepart\('actions'\)/.test(src),
      'l’ajout à la main part de la classe qu’il affiche');
    eq((src.match(/champCompteParDefaut\(/g) || []).length, 2, 'la case dans les deux fenêtres');
    eq((src.match(/poserCompteParDefaut\(/g) || []).length, 2, 'écrite par les deux, après la création');
    const recherche = src.slice(src.indexOf('const a = creerLigneAchetee({ ligne, brouillon, debit });'));
    vrai(/if \(a\.erreur\) \{ toast\(a\.erreur\); return; \}\s*poserCompteParDefaut\(/.test(recherche),
      'la préférence ne s’écrit qu’une fois la ligne créée');
    vrai(/prefere: c => compteDeDepart\(c\)/.test(src), 'une classe changée préfère le compte par défaut');
    vrai(!!I18N.en['Utiliser ce compte par défaut pour les prochaines lignes'], 'et la case se traduit');
  });
});

finDePartieDeTests('tests/34-compte-par-defaut.tests.js');
