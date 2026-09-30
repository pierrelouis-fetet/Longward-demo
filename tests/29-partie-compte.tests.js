partieDeTests('tests/29-partie-compte.tests.js');
/* ------------------------------------------------------------------
   La partie compte, relue en detenteur : un support monetaire, un credit
   verifie il y a des mois, un pret commun a deux, un bien a deux lots dont un
   sans cout. Chaque test prend un scenario qui fausse un chiffre affiche.
   Montants fictifs et ronds.
   ------------------------------------------------------------------ */
suite('La partie compte : les calculs d’un détenteur', () => {
  const somme = o => Object.values(o).reduce((s, v) => s + num(v), 0);
  const credit = extra => ({ id: 'd_test', libelle: 'Prêt', montant: 100000, initial: 100000,
                             mensualite: 1100, taux: 3.5, tauxAssurance: 0.36, ...extra });

  test('un support monétaire compte dans les liquidités, et les poches refont le brut', () => {
    Fixture.poser(s => s.positions.push({ id: 'p_mon', name: 'Trésorerie', isin: '', symbol: 'TRES',
      currency: 'EUR', qty: 100, buyPrice: 100, price: 100, fx: 1, fxBuy: 1, account: 'c_cto',
      manual: false, assetClass: 'monetaire', role: 'satellite' }));
    const p = patrimoine();
    pres(somme(nowByGroup()), p.brut, 'la somme des poches fait le brut, support monétaire compris');
    pres(nowByGroup().cash, p.classes.liquidites, 'la poche Liquidités vaut la classe entière');
    pres(liquiditesEnLignes(), 10000, 'la ligne monétaire se retrouve à part');
    pres(pochesLiquidites().reduce((s, x) => s + x.value, 0) + liquiditesEnLignes(), nowByGroup().cash,
      'les quatre affectations plus les supports refont les liquidités');
    pres(allocationByAsset().reduce((s, x) => s + x.value, 0), nowTotals().total,
      'et l’allocation par actif ne la compte pas deux fois');
    pres(capitalisation({ years: 5 }).points[0].total, p.net, 'la projection part du patrimoine net');
    /* Le seuil porte sur la somme des supports, pas sur chacun. */
    Fixture.poser(s => {
      for (const id of ['p_m1', 'p_m2']) s.positions.push({ id, name: id, isin: '', symbol: id,
        currency: 'EUR', qty: 1, buyPrice: 0.004, price: 0.004, fx: 1, fxBuy: 1, account: 'c_cto',
        manual: false, assetClass: 'monetaire', role: 'satellite' });
    });
    vrai(liquiditesEnLignes() !== 0, 'deux supports de quelques millimes se voient ensemble');
    Fixture.poser();
    eq(liquiditesEnLignes(), 0, 'sans support monétaire, rien à part');
    const app = lireSource('assets/app.js') || '';
    vrai(/value: liquiditesEnLignes\(\)/.test(app), 'la carte de disponibilité d’Allocation ajoute la ligne');
    eq((app.match(/l\.classe === 'liquidites'/g) || []).length >= 1
      && (app.match(/l\.classe !== 'liquidites'/g) || []).length >= 1, true,
      'et les deux fenêtres Liquidités listent les supports');
    vrai(/const supports = liquiditesEnLignes\(\) === 0 \? \[\]/.test(app)
      && /const avecSupports = !cle && liquiditesEnLignes\(\) !== 0;/.test(app),
      'avec le même seuil, porté sur leur somme');
    eq(I18N.en['Supports monétaires'], 'Money-market funds', 'le libellé se traduit');
  });

  test('l’échéancier d’un crédit vérifié il y a neuf mois part du solde d’aujourd’hui', () => {
    Fixture.poser();
    const ancien = credit({ verifieLe: dateApresMois(todayISO(), -9) });
    const pr = projectionCredit(ancien);
    vrai(pr.projete != null && pr.projete < ancien.montant, 'la projection rejoue les neuf mois');
    const frais = credit({ montant: pr.projete, verifieLe: todayISO() });
    const e1 = echeancierCredit(ancien), e2 = echeancierCredit(frais);
    eq(e1.finLe, e2.finLe, 'même date de fin que le même crédit vérifié aujourd’hui');
    pres(e1.interets, e2.interets, 'et les intérêts restants ne comptent pas les mois passés');
    eq(e1.depuisProjection, true, 'l’échéancier dit qu’il part d’une estimation');
    eq(e2.depuisProjection, false, 'un solde du jour ne se projette pas');
    eq(echeancierCredit(credit({})).depuisProjection, false, 'sans date de vérification non plus');
    /* Le panneau des credits lit la meme date de fin, et le dit. */
    Fixture.poser(s => Object.assign(s.etabs[2].dettes[0], { mensualite: 600, taux: 2,
      verifieLe: dateApresMois(todayISO(), -9) }));
    eq(creditsEnCours().lignes[0].depuisProjection, true, 'le panneau sait que sa fin vient d’un solde estimé');
    Fixture.poser();
  });

  test('un prêt commun amortit ta dette avec ta part de la mensualité', () => {
    Fixture.poser();
    /* 100 000 dus sur un pret commun de 200 000 a 3,5 %, 1 100 factures,
       30 d'assurance sur ta part empruntee. */
    const seul = echeancierCredit(credit({}));
    const commun = echeancierCredit(credit({ part: 50 }));
    pres(seul.capitalDuMois, 1100 - 30 - 100000 * 0.035 / 12, 'sans part, la facture entière amortit');
    pres(commun.capitalDuMois, 550 - 30 - 100000 * 0.035 / 12, 'à 50 %, ta moitié seulement');
    vrai(commun.mois > seul.mois * 2, 'et la fin recule en conséquence');
    pres(mensualiteAmortissante(credit({ part: 50 })), 550, 'la part amortissante');
    pres(mensualiteCredit(credit({ part: 50 })), 1100, 'la mensualité facturée, elle, ne change pas');
    eq(partCredit(credit({ part: 0 })), 1, 'une part nulle ne se lit pas');
    eq(partCredit(credit({ part: 150 })), 1, 'au-delà de cent non plus');
    eq(lirePartCredit('50'), 50, 'une part se stocke');
    eq(lirePartCredit('100'), null, 'cent n’est pas un partage');
    eq(lirePartCredit(''), null, 'le vide non plus');
    vrai(validerCreditSaisi({ partCredit: 0 }) !== null, 'la saisie refuse zéro');
    vrai(validerCreditSaisi({ partCredit: 150 }) !== null, 'et plus de cent');
    eq(validerCreditSaisi({ partCredit: 50 }), null, 'et accepte une vraie part');
    /* La part appartient au credit : ses deux fenetres la proposent toujours,
       la creation d'un bien seulement quand il est tenu a plusieurs. */
    eq((lireSource('assets/app.js').match(/champPartCredit\(/g) || []).length, 3,
      'le champ vit dans les trois fenêtres');
    /* La projection du patrimoine lit la meme part. */
    Fixture.poser(s => Object.assign(s.etabs[2].dettes[0],
      { initial: 100000, mensualite: 1100, taux: 3.5, part: 50 }));
    pres(dettesAmortissables()[0].mens, 550, 'la projection amortit ta part');
    /* La graine n'a pas de pret commun : ses chiffres ne bougent pas. */
    Store.state = structuredClone(SEED); Store.migrate(); refreshAccounts();
    for (const e of ETABS()) for (const d of (e.dettes || [])) {
      eq(mensualiteAmortissante(d), mensualiteCredit(d), `${d.libelle} : inchangé sans part`);
    }
    Fixture.poser();
  });

  test('le financement d’un bien à deux se compare à ta part du coût', () => {
    const poser = modifier => Fixture.poser(s => {
      Object.assign(s.comptes[4], { apport: 5000 });
      Object.assign(s.comptes[4].lignes[0], { part: 50 });
      Object.assign(s.etabs[2].dettes[0], { initial: 50000 });
      if (modifier) modifier(s);
    });
    poser();
    const c = compteById('c_immo');
    const plan = planFinancement(c);
    pres(plan.cout, 55000, 'la moitié des 110 000 du bien');
    pres(plan.ecart, 0, 'ton apport et ton prêt la couvrent exactement');
    poser(s => s.comptes[4].lignes.push({ id: 'l_park', classe: 'immobilier', libelle: 'Parking',
      valeur: 20000, quantite: 1, dateAcquisition: '' }));
    eq(planFinancement(compteById('c_immo')), null, 'un lot sans coût rend le plan incalculable');
    poser(s => Object.assign(s.comptes[4].lignes[0], { part: 150 }));
    eq(planFinancement(compteById('c_immo')), null, 'une quote-part invalide aussi');
    Fixture.poser();
  });

  test('un lot sans coût fait taire le rendement sur le prix payé', () => {
    Fixture.poser(s => s.comptes[4].lignes.push({ id: 'l_park', classe: 'immobilier',
      libelle: 'Parking', valeur: 20000, quantite: 1, dateAcquisition: '' }));
    const cf = cashFlowBien(compteById('c_immo'));
    eq(cf.surAchat, false, 'la base n’est pas un prix payé amputé');
    pres(cf.base, cf.valeur, 'elle retombe sur la valeur actuelle');
    Fixture.poser();
    eq(cashFlowBien(compteById('c_immo')).surAchat, true, 'un coût complet reste la base');
    Fixture.poser(s => Object.assign(s.comptes[4].lignes[0], { part: 150 }));
    eq(cashFlowBien(compteById('c_immo')).surAchat, false, 'une quote-part invalide la fait taire aussi');
    vrai(/const coutConnu = acq\.total != null && !acq\.partInvalide;/.test(lireSource('assets/app.js') || ''),
      'et la fiche applique la même garde');
    Fixture.poser();
  });

  test('le panneau Immobilier retranche un crédit une fois par compte', () => {
    Fixture.poser(s => {
      s.comptes[4].lignes.push({ id: 'l_park', classe: 'immobilier', libelle: 'Parking',
        valeur: 20000, prixDeRevient: 15000, quantite: 1, dateAcquisition: '' });
      /* Une assurance-vie avec une SCPI, et une avance chez l'assureur. */
      s.etabs.push({ id: 'e_assur', nom: 'Assureur', notes: '',
        dettes: [{ id: 'd_avance', libelle: 'Avance', montant: 3000, note: '' }] });
      s.comptes.push({ id: 'c_av', etabId: 'e_assur', type: 'av', statut: 'ouvert', ouvertLe: '',
        numero: '', notes: '', libelle: 'AV', court: 'AV', alloc: '', cash: [],
        lignes: [{ id: 'l_scpi', classe: 'immobilier', libelle: 'SCPI', valeur: 8000,
                   prixDeRevient: 8000, quantite: 1, dateAcquisition: '' }] });
    });
    const biens = biensImmobiliersParCompte();
    const studio = biens.find(b => b.compte.id === 'c_immo');
    eq(studio.lots.length, 2, 'les deux lots sous un seul compte');
    pres(studio.du, Fixture.DETTE, 'le prêt une seule fois');
    pres(studio.net, 140000 - Fixture.DETTE, 'la valeur nette du compte');
    const { d, i } = studio.dettes[0];
    eq(Store.state.etabs[studio.idxEtab].dettes[i], d, 'le rang désigne bien le crédit à écrire');
    const av = biens.find(b => b.compte.id === 'c_av');
    eq(av.dettes.length, 0, 'l’avance sur un contrat ne finance pas sa SCPI');
    pres(biens.reduce((s, b) => s + b.valeur, 0), patrimoine().classes.immobilier,
      'les comptes refont la classe');
    Fixture.poser();
  });
});

suite('La partie compte : les comptes et leurs textes', () => {
  const app = () => lireSource('assets/app.js') || '';

  test('un plafond de livret est un montant, et ne vit que sur un livret', () => {
    Fixture.poser();
    vrai(/cle: 'plafond'[\s\S]{0,200}genre: 'montant'/.test(app()), 'le champ se borne comme un montant');
    const livret = { type: 'livret', plafond: 22950, cash: [{ montant: 10000, affectation: 'precaution' }] };
    pres(resteAVerser(livret).reste, 12950, 'il reste 12 950 à verser');
    eq(resteAVerser({ ...livret, type: 'courant' }), null, 'un compte repassé en courant ne lit plus le plafond');
  });

  test('un compte passe à un type personnel, et une enveloppe sans cash refuse les espèces', () => {
    Fixture.poser();
    const pel = creerTypePerso('Plan épargne logement', 'cash');
    const courant = compteById('c_courant');
    vrai(changementDeTypePossible(courant, pel).ok, 'un type créé par le détenteur se choisit');
    const versPer = changementDeTypePossible(compteById('c_livret'), 'per');
    vrai(!versPer.ok, 'un livret garni ne devient pas un PER');
    vrai(/2[\s,.]?000/.test(versPer.raison), 'et le refus nomme le montant à déplacer');
    vrai(changementDeTypePossible({ ...courant, cash: [{ montant: 0, affectation: 'courant' }] }, 'per').ok,
      'une part à zéro ne bloque rien');
    Fixture.poser();
  });

  test('les espèces ne s’archivent ni ne se suppriment', () => {
    const src = app();
    const i = src.indexOf("async 'archiver-compte'(btn)");
    vrai(/if \(c && typeCompte\(c\.type\)\.interne\)/.test(src.slice(i, i + 900)), 'l’archivage refuse les espèces');
    vrai(/\$\{t\.interne && c\.statut !== 'archive' \? '' :/.test(src), 'leur fiche n’offre ni l’un ni l’autre');
    vrai(/\$\{typeCompte\(c\.type\)\.interne \? '' : `<button class="btn sm ghost" data-action="archiver-compte"/.test(src),
      'ni le tiroir de leur ligne');
    vrai(/\$\{t\.interne \? '' : `<button class="btn ghost danger" data-action="supprimer-compte"/.test(src),
      'et des espèces déjà archivées se restaurent sans se proposer à la suppression');
    eq(I18N.en['Les espèces ne s’archivent pas'], 'Cash in hand cannot be archived', 'et le refus se traduit');
  });

  test('un crédit dit ce qu’il finance, sans rien supposer', () => {
    Fixture.poser(s => {
      s.etabs.push({ id: 'e_seul', nom: 'Prêteur', notes: '', dettes: [{ id: 'd_seul', libelle: 'Prêt', montant: 1000 }] });
      s.etabs[2].dettes.push({ id: 'd_mort', libelle: 'Ancien', montant: 500, bienId: 'c_disparu' });
      s.etabs[2].dettes.push({ id: 'd_ail', libelle: 'Ailleurs', montant: 500, bienId: 'c_courant' });
    });
    const eBien = etabById('e_bien');
    const quoi = id => lienDette(ETABS().flatMap(e => (e.dettes || []).map(d => [d, e])).find(([d]) => d.id === id)[0],
                                 ETABS().find(e => (e.dettes || []).some(d => d.id === id))).quoi;
    eq(quoi('d_pret'), 'ouvert', 'le prêt du studio finance un compte ouvert, par le compte unique');
    eq(quoi('d_mort'), 'mort', 'un lien vers un compte disparu');
    eq(quoi('d_ail'), 'ailleurs', 'un lien vers un autre établissement');
    eq(quoi('d_seul'), 'seul', 'un crédit sans compte à côté');
    compteById('c_immo').statut = 'archive';
    eq(quoi('d_pret'), 'archive', 'le compte unique archivé');
    eq(motifOrphelin({ ...eBien, dettes: [eBien.dettes[0]] }).motif, 'archive', 'la page le dit archivé');
    eq(motifOrphelin({ ...eBien, dettes: [eBien.dettes[1]] }).motif, 'mort', 'ou supprimé');
    eq(motifOrphelin(etabById('e_seul')).motif, 'autre', 'et rien de plus quand rien ne le prouve');
    eq(motifOrphelin({ ...eBien, dettes: [eBien.dettes[2]] }).motif, 'ailleurs', 'un compte d’un autre établissement');
    const deux = motifOrphelin({ ...eBien, dettes: [eBien.dettes[0], eBien.dettes[0]] });
    vrai(deux.motif === 'archive' && deux.pluriel && deux.compte && deux.compte.id === 'c_immo',
      'deux crédits sur un même compte archivé le nomment, au pluriel');
    const melange = motifOrphelin({ ...eBien, dettes: [eBien.dettes[0], eBien.dettes[2]] });
    vrai(melange.motif === 'autre' && melange.compte === null,
      'des liens qui ne s’accordent pas ne se résument ni à un compte ni à une absence de lien');
    Fixture.poser(s => s.comptes.push({ ...s.comptes[4], id: 'c_immo2', libelle: 'Parking' }));
    eq(quoi('d_pret'), 'ambigu', 'deux comptes sans lien : ambigu');
    /* Le controle de sante ne liste que ce qu'on peut clarifier. */
    Fixture.poser(s => s.etabs.push({ id: 'e_seul', nom: 'Prêteur', notes: '', dettes: [{ id: 'd_seul', libelle: 'Prêt', montant: 1000 }] }));
    eq(creditsAClarifier().length, 0, 'un crédit seul n’est pas un lien à clarifier');
    Store.state = structuredClone(SEED); Store.migrate(); refreshAccounts();
    eq(creditsAClarifier().length, 0, 'la graine n’a rien à clarifier');
    Fixture.poser();
    vrai(/if \(filtre && !siens\.length\) return '';/.test(app()) && /const dette = credits && !filtre \?/.test(app()),
      'pendant une recherche, ni groupe vide ni net partiel');
  });

  test('un taux d’assurance absent se dit, un zéro déclaré non', () => {
    Fixture.poser();
    const d = { id: 'x', libelle: 'Prêt', montant: 100000, mensualite: 800, taux: 2 };
    eq(assuranceDeclaree(d), false, 'absent');
    eq(assuranceDeclaree({ ...d, tauxAssurance: 0 }), true, 'zéro déclaré');
    pres(echeancierCredit(d).capitalDuMois, echeancierCredit({ ...d, tauxAssurance: 0 }).capitalDuMois,
      'le moteur les calcule pareil');
  });

  test('ce qui s’affichait en français dans les deux langues se traduit', () => {
    for (const c of ['Placement dans {v}', 'Valeur du bien', 'Valeur de la participation', 'ce que cela vaut aujourd’hui',
                     'ex. Prêt immobilier', 'ex. Loyer studio Lyon', 'Loyer de {v}',
                     'seulement si tu renseignes une mensualité : elle entrera dans ton budget sous ce nom',
                     'facultatif. Mieux : rattache-le à une charge fixe, le montant ne sera alors saisi qu’une fois',
                     'facultatif, environ 0,3 % du capital emprunté : elle sort de la mensualité sans rembourser',
                     'Ce crédit finance un {mot} archivé.', 'Ces crédits ne financent plus rien.',
                     '{v} de capital restant dû continuent de se soustraire de ton patrimoine net.'])
      vrai(!!I18N.en[c], `« ${c.slice(0, 40)} » a sa traduction`);
    const src = app().replace(/\/\*[\s\S]*?\*\//g, '');
    vrai(!/titre: `Placement dans/.test(src) && !/`Loyer de \$\{/.test(src), 'plus de titre composé hors du dictionnaire');
    vrai(!/elle commande la disponibilité/.test(src), 'la date d’ouverture ne promet plus la disponibilité');
    vrai(!/noté pour mémoire/.test(src), 'et le taux d’un crédit dit à quoi il sert');
    vrai(/toast\(messageChampInvalide\(invalide\)\)/.test(src), 'un champ refusé sur une fiche dit pourquoi');
  });
});

suite('La partie compte : le PER et les contrats', () => {
  const app = () => (lireSource('assets/app.js') || '').replace(/\/\*[\s\S]*?\*\//g, '');

  test('un PER porte une date de déblocage déclarée, pas une ancienneté', () => {
    const per = typeCompte('per');
    vrai(!per.dateSensible, 'aucun seuil d’ancienneté ne le libère');
    eq(per.disponibilite, 'bloque', 'il reste bloqué');
    const src = app();
    vrai(/t\.echeanceUnique \? \[\s*\{ cle: 'ouvertLe'[\s\S]{0,300}cle: 'debloqueLe'/.test(src),
      'la création demande une ouverture facultative et le déblocage prévu');
    vrai(/if \('debloqueLe' in v\) pose\('debloqueLe', v\.debloqueLe\);/.test(src), 'la modification l’enregistre');
    vrai(/t\.echeanceUnique && c\.debloqueLe \?/.test(src), 'et la fiche le dit en tête');
    eq(I18N.en['Déblocage prévu'], 'Planned release', 'en anglais aussi');
  });

  test('la valeur d’un PER s’entend avant l’impôt de sortie', () => {
    vrai(/avant l’impôt éventuel dû à la sortie/.test(typeCompte('per').retrait), 'le texte des retraits le dit');
    vrai(!!I18N.en[typeCompte('per').retrait], 'et se traduit');
  });

  test('un contrat se nomme contrat, un plan se nomme plan', () => {
    enLangue('fr', () => {
      eq(motCompte(typeCompte('per')), 'contrat', 'un PER se souscrit chez un assureur');
      eq(motCompte(typeCompte('av')), 'contrat', 'une assurance-vie aussi');
      eq(motCompte(typeCompte('us401k')), 'plan', 'un 401(k) est un plan');
      eq(motCompte(typeCompte('cto')), 'compte', 'un compte-titres reste un compte');
      eq(motCompte(typeCompte('immo')), 'bien', 'un appartement reste un bien');
    });
    vrai(/t\.melange \? trad\(', ajoute ses supports sur sa fiche'\)/.test(app()),
      'la création d’un contrat dit où vont ses supports');
  });
});

finDePartieDeTests('tests/29-partie-compte.tests.js');
