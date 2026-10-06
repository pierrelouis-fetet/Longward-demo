partieDeTests('tests/38-import-tableau.tests.js');
/* ------------------------------------------------------------------
   L'import d'un tableau : un export de banque ou un tableau de suivi,
   lu sur l'appareil et range dans les depenses ou les releves.
   Tous les fichiers et tous les montants sont fictifs.
   ------------------------------------------------------------------ */

/* Un ZIP construit ici, entree par entree, stocke ou compresse : de quoi
   eprouver le lecteur sur autre chose que l'export maison. Le lecteur ne
   verifie pas les CRC, on y met donc zero. */
async function zipDeTest(fichiers, { deflate = false } = {}) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  for (const [nom, texte] of Object.entries(fichiers)) {
    const brut = enc.encode(texte);
    let donnees = brut;
    if (deflate) {
      const flux = new Blob([brut]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      donnees = new Uint8Array(await new Response(flux).arrayBuffer());
    }
    const n = enc.encode(nom);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(8, deflate ? 8 : 0, true);
    lh.setUint32(18, donnees.length, true); lh.setUint32(22, brut.length, true);
    lh.setUint16(26, n.length, true);
    parts.push(new Uint8Array(lh.buffer), n, donnees);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(10, deflate ? 8 : 0, true);
    ch.setUint32(20, donnees.length, true); ch.setUint32(24, brut.length, true);
    ch.setUint16(28, n.length, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), n);
    offset += 30 + n.length + donnees.length;
  }
  const taille = central.reduce((s, p) => s + p.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, Object.keys(fichiers).length, true); fin.setUint16(10, Object.keys(fichiers).length, true);
  fin.setUint32(12, taille, true); fin.setUint32(16, offset, true);
  const tout = [...parts, ...central, new Uint8Array(fin.buffer)];
  const out = new Uint8Array(tout.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of tout) { out.set(p, o); o += p.length; }
  return out;
}

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/* Un classeur fictif : chaine partagee riche (avec sa prononciation),
   chaine en ligne, formule avec et sans valeur, date par son style. */
function classeurDeTest({ date1904 = false } = {}) {
  return {
    'xl/workbook.xml': `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">`
      + `${date1904 ? '<workbookPr date1904="1"/>' : ''}<sheets><sheet name="Compte" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/sharedStrings.xml': `<sst xmlns="${NS_MAIN}"><si><t>Date</t></si>`
      + '<si><r><t>CB MARCHE</t></r><r><t> DU COIN</t></r><rPh><t>ignore</t></rPh></si></sst>',
    'xl/styles.xml': `<styleSheet xmlns="${NS_MAIN}"><numFmts><numFmt numFmtId="170" formatCode="dd/mm/yyyy"/></numFmts>`
      + '<cellXfs><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="170"/></cellXfs></styleSheet>',
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="${NS_MAIN}"><sheetData>`
      + '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>Libellé</t></is></c>'
      + '<c r="C1" t="str"><f>"Montant"</f><v>Montant</v></c></row>'
      + '<row r="2"><c r="A2" s="1"><v>45200</v></c><c r="B2" t="s"><v>1</v></c><c r="C2"><v>-12.5</v></c>'
      + '<c r="E2"><f>SUM(X1)</f></c></row>'
      + '<row r="4"><c r="A4" s="2"><v>60</v></c></row>'
      + '</sheetData></worksheet>',
  };
}

suite('Import d’un tableau : lecture des fichiers', () => {
  test('un CSV : séparateur deviné, guillemets, sauts de ligne dans un champ', () => {
    const g = lireCSV('Date;Libellé;Montant\n01/10/2026;"CB ""LE"" CAFE; centre";-3,20\r\n02/10/2026;"Ligne\nsur deux";-4\n');
    eq(g.length, 3, 'trois lignes');
    eq(g[1][1].v, 'CB "LE" CAFE; centre', 'guillemet doublé et séparateur dans le champ');
    eq(g[2][1].v, 'Ligne\nsur deux', 'saut de ligne gardé dans le champ');
    eq(lireCSV('a,b,c\n1,2,3')[1].length, 3, 'la virgule seule aussi');
    const titre = lireCSV('Export, compte courant\nDate;Libellé;Montant\n01/10/2026;CB CAFE;-3,20\n02/10/2026;CB PAIN;-1,10');
    eq(titre[1].length, 3, 'un titre à virgule au-dessus d’un tableau à point-virgule ne trompe pas');
    eq(titre[2][2].v, '-3,20', 'et la virgule décimale reste dans le montant');
    eq(lireCSV('a\tb\n1\t2')[1][1].v, '2', 'et la tabulation');
  });

  test('un texte windows-1252 se décode, l’UTF-8 aussi', () => {
    eq(decoderTexte(new Uint8Array([0x44, 0xE9, 0x62, 0x69, 0x74])), 'Débit', 'é en windows-1252');
    eq(decoderTexte(new TextEncoder().encode('﻿Débit')), 'Débit', 'UTF-8 et son BOM retiré');
  });

  test('les nombres des banques', () => {
    eq(nombreDepuisTexte('1 234,56 €'), 1234.56);
    eq(nombreDepuisTexte('-12,30'), -12.3);
    eq(nombreDepuisTexte('1,234.56'), 1234.56);
    eq(nombreDepuisTexte('1.234,56'), 1234.56);
    eq(nombreDepuisTexte('(12,30)'), -12.3, 'parenthèses : négatif');
    eq(nombreDepuisTexte('12,30-'), -12.3, 'signe en fin');
    eq(nombreDepuisTexte('1.234'), 1234, 'groupe de trois chiffres seul : milliers');
    eq(nombreDepuisTexte('12.5'), 12.5);
    eq(nombreDepuisTexte('abc'), null);
    eq(nombreDepuisTexte(''), null);
  });

  test('les dates : ordre deviné par colonne, demandé quand rien ne tranche', () => {
    const t = v => ({ t: 'texte', v });
    eq(ordreDesDates([t('03/04/2026'), t('25/04/2026')]), 'jm', 'un jour > 12 en tête : jour/mois');
    eq(ordreDesDates([t('04/03/2026'), t('04/25/2026')]), 'mj', 'un jour > 12 en second : mois/jour');
    eq(ordreDesDates([t('03/04/2026'), t('05/06/2026')]), null, 'tout ≤ 12 : rien ne tranche');
    eq(ordreDesDates([t('25/04/2026'), t('04/25/2026')]), null, 'indices contraires : rien non plus');
    vrai(ordreAChoisir([t('03/04/2026')]).aDemander, 'et il faut alors demander');
    eq(jourDepuisCellule(t('03/04/2026'), 'jm'), '2026-04-03');
    eq(jourDepuisCellule(t('03/04/2026'), 'mj'), '2026-03-04');
    eq(jourDepuisCellule(t('31/02/2026'), 'jm'), null, 'un jour impossible est refusé');
    eq(jourDepuisCellule(t('2026-10-05')), '2026-10-05');
    eq(jourDepuisCellule(t('05.10.26')), '2026-10-05');
    eq(moisDepuisCellule(t('janv. 2024')), '2024-01-01');
    eq(moisDepuisCellule(t('Septembre 2025')), '2025-09-01');
    eq(moisDepuisCellule(t('Jan 2024')), '2024-01-01');
    eq(moisDepuisCellule(t('01/2024')), '2024-01-01');
    eq(moisDepuisCellule(t('2024-03')), '2024-03-01');
  });

  test('les séries Excel, et le faux 29 février 1900', () => {
    eq(serieExcelEnDate(59), '1900-02-28');
    eq(serieExcelEnDate(60), null, 'la série 60 ne désigne aucun jour');
    eq(serieExcelEnDate(61), '1900-03-01');
    eq(serieExcelEnDate(45200), '2023-10-01');
    eq(serieExcelEnDate(0, true), '1904-01-01', 'le système 1904 part du 1er janvier 1904, série 0');
    eq(serieExcelEnDate(1, true), '1904-01-02');
    eq(serieExcelEnDate(0), null, 'le système 1900 n’a pas de série 0');
  });

  test('un classeur stocké et un classeur compressé se lisent pareil', async () => {
    for (const deflate of [false, true]) {
      const f = await lireFichierTableau('releve.xlsx', await zipDeTest(classeurDeTest(), { deflate }));
      eq(f.length, 1, 'une feuille');
      eq(f[0].nom, 'Compte');
      const g = f[0].grille;
      eq(g[0][0].v, 'Date', 'chaîne partagée');
      eq(g[0][1].v, 'Libellé', 'chaîne en ligne');
      eq(g[0][2].v, 'Montant', 'formule avec sa valeur en cache');
      eq(g[1][0].t, 'date'); eq(g[1][0].v, '2023-10-01', 'date par le style 14');
      eq(g[1][1].v, 'CB MARCHE DU COIN', 'chaîne riche, sans sa prononciation');
      eq(g[1][2].v, -12.5, 'nombre');
      eq(g[1][4].t, 'illisible', 'formule sans valeur : illisible');
      eq(g[3][0].t, 'illisible', 'la série 60 sous un style de date : illisible');
    }
    const f1904 = await lireFichierTableau('r.xlsx', await zipDeTest(classeurDeTest({ date1904: true })));
    eq(f1904[0].grille[1][0].v, '2027-10-02', 'le même numéro en système 1904 tombe 1 462 jours plus tard');
  });

  test('les fichiers qu’on ne lit pas sont refusés proprement', async () => {
    const code = async (nom, b) => { try { await lireFichierTableau(nom, b); return 'lu'; } catch (e) { return e.code; } };
    eq(await code('vieux.xls', new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0, 0, 0, 0])), 'xls', 'un .xls binaire');
    const z = await zipDeTest(classeurDeTest());
    eq(await code('coupe.xlsx', z.slice(0, z.length - 30)), 'zip-incomplet', 'une archive coupée');
    const chiffre = z.slice();
    const i = chiffre.length - 22 - (46 + 'xl/worksheets/sheet1.xml'.length);
    vrai(new DataView(chiffre.buffer).getUint32(i, true) === 0x02014b50, 'le test vise bien une entrée centrale');
    chiffre[i + 8] |= 1;
    eq(await code('chiffre.xlsx', chiffre), 'zip-chiffre', 'une archive chiffrée');
    eq(await code('gros.csv', new Uint8Array(IMPORT_LIMITES.fichier + 1)), 'trop-gros', 'un fichier trop gros');
    /* Une taille annoncee qui ment : la lecture s'arrete des qu'elle la depasse. */
    const menteur = (await zipDeTest(classeurDeTest(), { deflate: true })).slice();
    const dv = new DataView(menteur.buffer);
    const j = menteur.length - 22 - (46 + 'xl/worksheets/sheet1.xml'.length);
    dv.setUint32(j + 24, 5, true);
    eq(await code('menteur.xlsx', menteur), 'zip-incomplet', 'une taille décompressée mensongère');
  });

  test('l’en-tête se trouve, et un suivi aux mois en colonnes se retourne', () => {
    const g = lireCSV('Export du compte\n\nDate;Libellé;Montant\n01/10/2026;CAFE;-3');
    eq(detecterEntete(g), 2, 'la ligne d’en-tête après le titre');
    const suivi = lireCSV('Compte;janv. 2026;févr. 2026;mars 2026\nLivret;100;110;120\nCourant;50;60;70');
    const o = orienterMoisEnLignes(suivi);
    vrai(o.retournee, 'retourné');
    eq(o.grille[1][0].v, 'janv. 2026'); eq(o.grille[0][1].v, 'Livret'); eq(o.grille[2][2].v, '60');
  });
});

suite('Import d’un tableau : les dépenses d’une banque', () => {
  const grilleBanque = texte => {
    const g = lireCSV(texte);
    const d = detecterEntete(g);
    return { g, d, entete: g[d], lignes: g.slice(d + 1) };
  };

  test('les colonnes se devinent, montant unique ou paire débit/crédit', () => {
    const a = grilleBanque('Date opération;Date de valeur;Libellé;Montant;Catégorie\n01/10/2026;02/10/2026;CB CAFE;-3,20;Restos');
    const c = devinerColonnesOperations(a.entete, a.lignes);
    eq(c.date, 0, 'la date d’opération, pas celle de valeur');
    eq(c.libelle, 2); eq(c.montant, 3); eq(c.categorie, 4); eq(c.debit, -1);
    const b = grilleBanque('Date;Libellé;Débit;Crédit\n01/10/2026;CB CAFE;3,20;\n02/10/2026;VIR SALAIRE;;1000');
    const cb = devinerColonnesOperations(b.entete, b.lignes);
    eq(cb.debit, 2); eq(cb.credit, 3); eq(cb.montant, -1);
  });

  test('le sens des montants, et les crédits comptés à part', () => {
    const a = grilleBanque('Date;Libellé;Montant\n01/10/2026;CB CAFE;-3,20\n02/10/2026;REMBOURSEMENT CAFE;3,20\n03/10/2026;CB PAIN;-1,10');
    const col = devinerColonnesOperations(a.entete, a.lignes);
    eq(sensMajoritaire(a.lignes, col.montant), 'negatif', 'la majorité des sorties est négative');
    const { lignes } = lignesOperations(a.g, a.d + 1, col, { sens: 'negatif' });
    eq(lignes.filter(l => !l.credit).length, 2, 'deux dépenses');
    eq(lignes.filter(l => l.credit).length, 1, 'le remboursement est un crédit');
    const positif = lignesOperations(a.g, a.d + 1, col, { sens: 'positif' }).lignes;
    eq(positif.filter(l => !l.credit).map(l => l.libelle).join(','), 'REMBOURSEMENT CAFE', 'banque aux débits positifs');
    const b = grilleBanque('Date;Libellé;Débit;Crédit\n01/10/2026;CB CAFE;3,20;\n02/10/2026;VIR SALAIRE;;1000');
    const lb = lignesOperations(b.g, b.d + 1, devinerColonnesOperations(b.entete, b.lignes)).lignes;
    eq(lb.map(l => `${l.montant}${l.credit ? 'c' : ''}`).join(','), '3.2,1000c', 'débit dépense, crédit entrée');
  });

  test('les lignes écartées disent leur raison, et bloquent quand il faut décider', () => {
    const a = grilleBanque('Date;Libellé;Montant\n01/10/2026;CB CAFE;-3,20\n??;CB PAIN;-1,10\n02/10/2026;CB THE;abc\n;Solde final;-4,30\n03/10/2026;FRAIS;0');
    const col = devinerColonnesOperations(a.entete, a.lignes);
    const { lignes, ecartees } = lignesOperations(a.g, a.d + 1, col, { sens: 'negatif' });
    eq(lignes.length, 1, 'une seule ligne lisible');
    eq(ecartees.map(e => e.raison).join(','), 'date,montant,pied,zero', 'chacune sa raison');
    const choix = [''];
    const b = blocagesOperations({ col, lignes, choix, ecartees });
    eq(b.map(x => x.code).join(','), 'ecartees,a-choisir', 'deux lignes à écarter, une dépense à ranger');
    eq(blocagesOperations({ col, lignes, choix: ['Courses'], ecartees, ecarteesAcceptees: true }).length, 0,
      'écartées acceptées et dépense rangée : on peut valider');
    eq(blocagesOperations({ col, lignes, choix: ['Courses'], ecartees: [], ordreADemander: true }).map(x => x.code).join(','),
      'ordre', 'une date ambiguë sans réponse bloque');
  });

  test('débit et crédit : jamais la même colonne, jamais remplis ensemble sans décision', () => {
    const a = grilleBanque('Date;Libellé;Débit;Crédit\n01/10/2026;CB CAFE;3,20;\n02/10/2026;ETRANGE;5;7');
    const col = devinerColonnesOperations(a.entete, a.lignes);
    const { lignes, ecartees } = lignesOperations(a.g, a.d + 1, col);
    eq(lignes.length, 1, 'la ligne normale');
    eq(ecartees.map(e => e.raison).join(','), 'debit-credit', 'la ligne aux deux montants s’écarte');
    eq(ecartees[0].montant, 12, 'en gardant ses deux montants pour le rapprochement');
    const plan = planOperations(lignes, ['Courses']);
    const r = rapprochementOperations(lignes, ecartees, plan);
    pres(r.lu, 3.2 + 12, 'lus : la dépense et les deux montants de la ligne écartée');
    pres(r.lu, r.importe + r.credits + r.ignore + r.aClasser + r.ecarte, 'et l’égalité tient');
    eq(blocagesOperations({ col, lignes, choix: ['Courses'], ecartees }).map(b => b.code).join(','), 'ecartees',
      'et demande une décision');
    eq(blocagesOperations({ col: { ...col, credit: col.debit }, lignes, choix: ['Courses'], ecartees, ecarteesAcceptees: true })
      .map(b => b.code).join(','), 'meme-colonne', 'une seule colonne pour les deux sens est refusée');
  });

  test('la clé d’un marchand, et une charge fixe proposée, jamais imposée', () => {
    eq(cleMarchand('CB CARREFOUR MARKET 03/10 PARIS 15'), 'carrefour market paris');
    eq(cleMarchand('PRLV SEPA FOURNISSEUR ENERGIE'), 'fournisseur energie');
    eq(cleMarchand('CB CARREFOUR MARKET 04/10 PARIS 15'), cleMarchand('CB CARREFOUR MARKET 03/10 PARIS 15'), 'deux jours, un marchand');
    const charges = [{ label: 'Loyer', amount: 700, period: 'mois', provider: 'Agence du quartier' }];
    vrai(!!chargeFixeProbable({ libelle: 'VIR LOYER OCTOBRE', montant: 700 }, charges), 'même montant');
    vrai(!!chargeFixeProbable({ libelle: 'PRLV AGENCE DU QUARTIER', montant: 12 }, charges), 'même fournisseur');
    vrai(!chargeFixeProbable({ libelle: 'CB CAFE', montant: 3.2 }, charges), 'rien en commun');
    const p = proposerCategories([{ libelle: 'VIR LOYER', montant: 700 }, { libelle: 'CB CAFE', montant: 3.2, categorieBanque: 'restos' },
                                  { libelle: 'CB MARCHE DU COIN', montant: 20 }, { libelle: 'CB AUTRE', montant: 5 }],
      { regles: { 'marche coin': 'Courses' }, categories: ['Courses', 'Restos'], charges });
    eq(p.map(x => `${x.choix}:${x.raison}`).join(','), '__ignorer:charge,Restos:banque,Courses:regle,:', 'charge, banque, règle, rien');
  });

  test('le plan : chaque total est la somme de ses lignes, et le rapprochement tombe juste', () => {
    const lignes = [
      { date: '2026-09-02', libelle: 'A', montant: 10.1, credit: false },
      { date: '2026-09-28', libelle: 'B', montant: 20.2, credit: false },
      { date: '2026-10-01', libelle: 'C', montant: 5, credit: false },
      { date: '2026-10-02', libelle: 'D', montant: 7, credit: true },
      { date: '2026-10-03', libelle: 'E', montant: 3, credit: false },
    ];
    const plan = planOperations(lignes, ['Courses', 'Restos', 'Courses', '', IGNORER]);
    eq(JSON.stringify(plan.mois['2026-09-01'].v), JSON.stringify({ Courses: 10.1, Restos: 20.2 }));
    pres(plan.mois['2026-09-01'].total, 30.3, 'le total du mois, somme de ses catégories');
    eq(plan.mois['2026-09-01'].du, '2026-09-02'); eq(plan.mois['2026-09-01'].au, '2026-09-28');
    const r = rapprochementOperations(lignes, [{ raison: 'date', montant: 4 }], plan);
    pres(r.lu, r.importe + r.credits + r.ignore + r.aClasser + r.ecarte, 'importé + crédits + ignoré + à classer + écarté = lu');
    pres(r.credits, 7); pres(r.ignore, 3); pres(r.ecarte, 4); pres(r.aClasser, 0);
    const enAttente = planOperations(lignes, ['Courses', '', '', '', IGNORER]);
    const r2 = rapprochementOperations(lignes, [], enAttente);
    pres(r2.aClasser, 25.2, 'deux dépenses sans catégorie : à classer');
    pres(r2.lu, r2.importe + r2.credits + r2.ignore + r2.aClasser + r2.ecarte, 'l’égalité tient avant le classement');
  });

  test('l’état d’un mois : saisi, incomplet, en cours, à venir', () => {
    const e = (du, au) => ({ v: { Courses: 10 }, total: 10, du, au });
    eq(etatMoisImport('2026-08-01', e('2026-08-01', '2026-08-31'), null, '2026-10-06').defaut, 'remplacer', 'vide et complet');
    eq(etatMoisImport('2026-08-01', e('2026-08-15', '2026-08-31'), null, '2026-10-06').defaut, 'garder', 'commence le 15 : incomplet');
    const saisi = etatMoisImport('2026-08-01', e('2026-08-01', '2026-08-31'), { v: { Courses: 5, Loisirs: 8 } }, '2026-10-06');
    eq(saisi.defaut, 'garder', 'déjà saisi : gardé par défaut');
    eq(saisi.disparues.map(x => x.categorie).join(','), 'Loisirs', 'la catégorie qui disparaîtrait se nomme');
    vrai(etatMoisImport('2026-10-01', e('2026-10-01', '2026-10-05'), null, '2026-10-06').enCours, 'mois en cours');
    eq(etatMoisImport('2026-10-01', e('2026-10-01', '2026-10-05'), null, '2026-10-06').defaut, 'remplacer', 'en cours et vide : importé');
    const avenir = etatMoisImport('2026-11-01', e('2026-11-01', '2026-11-30'), null, '2026-10-06');
    vrai(avenir.aVenir && avenir.defaut === 'garder', 'à venir : pas importé par défaut');
  });

  test('écrire remplace le mois, deux fois de suite donne le même état', () => {
    Fixture.poser(s => {
      s.budget.categories = ['Courses', 'Restos', 'Loisirs'];
      s.budget.expenses = [{ month: '2026-09-01', note: 'n', v: { Courses: 999, Loisirs: 8 },
                             avantRegroupement: { v: { Courses: 1 }, total: 1 } }];
      s.budget.reglesImport = {};
    });
    const plan = { cible: 'depenses', forme: 'operations',
                   mois: { '2026-09-01': { v: { Courses: 30.3, Restos: 5 } }, '2025-02-01': { v: { Courses: 1 } } },
                   regles: { cafe: 'Restos' } };
    const r1 = ecrireImport(plan, { sauver: false });
    vrai(r1.ok, 'écrit');
    const sept = Store.state.budget.expenses.find(x => x.month === '2026-09-01');
    eq(JSON.stringify(sept.v), JSON.stringify({ Courses: 30.3, Restos: 5 }), 'le mois remplacé, Loisirs compris');
    eq(sept.note, 'n', 'la note reste');
    vrai(!sept.avantRegroupement, 'la mémoire d’un regroupement ne survit pas au remplacement');
    eq(Store.state.budget.expenses.filter(x => x.month.startsWith('2025-')).length, 12, 'une année nouvelle reçoit ses douze mois');
    eq(Store.state.budget.reglesImport.cafe, 'Restos', 'la règle apprise');
    const avant = JSON.stringify(Store.state.budget.expenses);
    ecrireImport(plan, { sauver: false });
    eq(JSON.stringify(Store.state.budget.expenses), avant, 'réimporter le même fichier ne change rien');
  });

  test('une erreur au milieu ne laisse aucun mois à moitié importé', () => {
    Fixture.poser(s => { s.budget.categories = ['Courses']; s.budget.expenses = [{ month: '2026-09-01', note: '', v: { Courses: 1 } }]; });
    const avant = JSON.stringify(Store.state);
    const piege = { cible: 'depenses', forme: 'operations', mois: { '2026-08-01': { v: { Courses: 2 } } } };
    Object.defineProperty(piege.mois, '2026-09-01', { enumerable: true, get() { throw new Error('piège'); } });
    const r = ecrireImport(piege, { sauver: false });
    vrai(!r.ok, 'refusé');
    eq(JSON.stringify(Store.state), avant, 'l’état est intact');
  });

  test('les règles suivent les catégories renommées et supprimées', () => {
    Fixture.poser(s => { s.budget.categories = ['Courses', 'Restos']; s.budget.reglesImport = { a: 'Courses', b: 'Restos', c: IGNORER }; });
    renameExpenseCategory('Courses', 'Alimentation');
    eq(Store.state.budget.reglesImport.a, 'Alimentation', 'renommée');
    removeExpenseCategory('Restos');
    vrai(!('b' in Store.state.budget.reglesImport), 'supprimée avec sa catégorie');
    eq(Store.state.budget.reglesImport.c, IGNORER, 'ignorer reste');
  });
});

suite('Import d’un tableau : les tableaux par mois', () => {
  test('dépenses par mois : forme devinée, catégories mappées seules, vide garde, zéro efface', () => {
    const g = lireCSV('Mois;Total;Courses;Restos;Note\njanv. 2026;50;30;;\nfévr. 2026;40;0;40;x');
    const cats = ['Courses', 'Restos', 'Loisirs'];
    eq(devinerFormeDepenses(g[0], g.slice(1), cats), 'mois', 'des en-têtes qui sont des catégories, aucun libellé');
    const { date, colonnes } = devinerColonnesMois(g[0], g.slice(1), cats);
    eq(date, 0); eq(colonnes.join('|'), '||Courses|Restos|', 'Total et Note ignorés');
    const { lignes, doublons } = lignesParMois(g, 1, date, colonnes);
    eq(Object.keys(doublons).length, 0);
    const mois = planParMois(lignes, 'depenses');
    Fixture.poser(s => {
      s.budget.categories = cats;
      s.budget.expenses = [{ month: '2026-01-01', note: '', v: { Restos: 12, Loisirs: 9 } },
                           { month: '2026-02-01', note: '', v: { Courses: 5, Loisirs: 9 } }];
    });
    vrai(ecrireImport({ cible: 'depenses', forme: 'mois', mois }, { sauver: false }).ok, 'écrit');
    const jan = Store.state.budget.expenses.find(x => x.month === '2026-01-01').v;
    const fev = Store.state.budget.expenses.find(x => x.month === '2026-02-01').v;
    eq(JSON.stringify(jan), JSON.stringify({ Restos: 12, Loisirs: 9, Courses: 30 }), 'vide : Restos garde 12');
    eq(JSON.stringify(fev), JSON.stringify({ Loisirs: 9, Restos: 40 }), 'zéro : Courses retiré ; Loisirs non mappé reste');
    eq(blocagesColonnesMois(['', 'Courses', 'Courses'], 0).map(b => b.code).join(','), 'categorie-double', 'deux colonnes vers une catégorie');
  });

  test('un mois en double se résout avant de valider', () => {
    const g = lireCSV('Mois;Courses\njanv. 2026;10\njanv. 2026;20\nfévr. 2026;5');
    const { lignes, doublons } = lignesParMois(g, 1, 0, ['', 'Courses']);
    eq(JSON.stringify(doublons), JSON.stringify({ '2026-01-01': [1, 2] }), 'les deux lignes nommées');
    eq(doublonsNonResolus(doublons, {}).join(','), '2026-01-01', 'non résolu');
    eq(doublonsNonResolus(doublons, { '2026-01-01': 2 }).length, 0, 'résolu');
    eq(planParMois(lignes, 'depenses', { '2026-01-01': 2 })['2026-01-01'].v.Courses, 20, 'la ligne choisie');
  });
});

suite('Import d’un tableau : les relevés', () => {
  const comptes = [
    { id: 'c1', label: 'Livret maison', broker: 'Banque Une', legacy: false },
    { id: 'c2', label: 'Compte courant', broker: 'Banque Deux', legacy: false },
    { id: 'c3', label: 'Compte joint', broker: 'Banque Deux', legacy: false },
    { id: 'c4', label: 'Ancien livret', broker: 'Banque Trois', legacy: true },
  ];

  test('une colonne ne se pré-remplit que sur une correspondance unique', () => {
    const g = lireCSV('Date;Livret maison;Banque Deux;Banque Une;Ancien livret;Total;Emprunt\n01/2026;100;50;10;5;165;9000');
    const c = devinerColonnesReleves(g[0], g.slice(1), comptes);
    eq(c[0], 'date');
    eq(c[1].compte, 'c1', 'nom exact d’un compte ouvert');
    eq(c[2], '', 'un établissement à deux comptes : à choisir');
    eq(c[3].compte, 'c1', 'un établissement à un seul compte ouvert');
    eq(c[4], '', 'un compte clôturé ne se pré-remplit pas');
    eq(c[5], IGNORER, 'le total s’ignore');
    eq(c[6], 'dettes', 'une seule colonne de dette');
    eq(blocagesColonnesReleves(g[0], c).map(b => b.code).join(','), 'compte-double', 'deux colonnes vers le même compte');
  });

  test('plusieurs dettes se somment, mais jamais avec leur total', () => {
    const g = lireCSV('Date;Prêt auto;Prêt maison;Total dettes\n01/2026;-1000;20000;21000');
    const c = devinerColonnesReleves(g[0], g.slice(1), comptes);
    eq(c.slice(1).join(','), ',,', 'trois colonnes de dette : à choisir');
    eq(blocagesColonnesReleves(g[0], ['date', 'dettes', 'dettes', 'dettes']).map(b => b.code).join(','), 'dettes-total');
    const { lignes } = lignesParMois(g, 1, 0, [null, 'dettes', 'dettes', null]);
    eq(planParMois(lignes, 'releves')['2026-01-01'].dettes, 21000, 'les parts sans le total, en valeur absolue');
  });

  test('l’export Longward se reconnaît', () => {
    const g = lireCSV('Date;Liquidités;Total brut;Crédits;Total net;Livret maison;Livret maison · cash;Commentaire\n2026-01-01;100;100;0;100;100;;');
    const c = devinerColonnesReleves(g[0], g.slice(1), comptes, { ignorer: ['Liquidités'] });
    eq(JSON.stringify(c), JSON.stringify(['date', IGNORER, IGNORER, 'dettes', IGNORER, { compte: 'c1' }, IGNORER, IGNORER]));
  });

  test('un relevé déjà rempli : seuls les comptes importés changent, le reste est gardé', () => {
    Fixture.poser(s => {
      s.monthly = [{ date: '2026-01-01', comment: 'janvier', dettes: 500, clotureLe: '2026-01-02',
                     autoTitres: { x: 1 }, v: { c_courant: 3000, c_livret: 2000 } }];
    });
    const r0 = Store.state.monthly[0];
    r0.parts = partsDuReleve(r0.v);
    const partsCourant = JSON.stringify(r0.parts.c_courant);
    vrai(ecrireImport({ cible: 'releves', mois: { '2026-01-01': { v: { c_livret: 2500 } } } }, { sauver: false }).ok);
    const r = Store.state.monthly.find(x => x.date === '2026-01-01');
    eq(r.v.c_courant, 3000, 'l’autre compte reste'); eq(r.v.c_livret, 2500, 'le compte importé change');
    eq(JSON.stringify(r.parts.c_courant), partsCourant, 'et sa ventilation aussi');
    eq(r.dettes, 500, 'sans colonne de dette, la dette reste');
    eq(r.comment, 'janvier'); eq(JSON.stringify(r.autoTitres), '{"x":1}');
    vrai(!r.clotureLe, 'la date de la photo s’efface sur un mois modifié');
    pres(rowTotal(r), 5500, 'le brut est la somme des comptes');
    pres(rowNet(r), 5000, 'et le net, le brut moins la dette');
  });

  test('une ventilation fait exactement le montant du compte, au centime', () => {
    Fixture.poser();
    for (const a of ACCOUNTS.filter(x => !x.fantome)) {
      for (const montant of [0.01, 0.03, 1234.57]) {
        const p = partsDuReleve({ [a.id]: montant })[a.id];
        pres(Object.values(p).reduce((s, x) => s + x, 0), montant, `${a.id} à ${montant}`);
      }
    }
    Fixture.poser(s => { s.monthly = [{ date: '2026-01-01', comment: '', v: { c_courant: 3000 } }]; });
    vrai(ecrireImport({ cible: 'releves', mois: { '2026-01-01': { v: { c_pea: 0.01, c_cto: 1234.57 } } } }, { sauver: false }).ok);
    const r = Store.state.monthly[0];
    pres(rowTotal(r), 3000 + 0.01 + 1234.57, 'le brut du relevé est la somme exacte de ses comptes');
  });

  test('un relevé gardé déjà déséquilibré d’un centime se corrige sans changer sa répartition', () => {
    Fixture.poser(s => { s.monthly = [{ date: '2026-01-01', comment: '', v: { c_courant: 3000, c_pea: 100 } }]; });
    const r0 = Store.state.monthly[0];
    r0.parts = partsDuReleve(r0.v);
    const k = Object.keys(r0.parts.c_pea)[0];
    r0.parts.c_pea[k] = round2(r0.parts.c_pea[k] + 0.01);
    pres(rowTotal(r0), 3100.01, 'l’ancien relevé porte un centime de trop');
    vrai(ecrireImport({ cible: 'releves', mois: { '2026-01-01': { v: { c_courant: 3100 } } } }, { sauver: false }).ok);
    const r = Store.state.monthly[0];
    pres(rowTotal(r), 3200, 'la somme exacte des comptes');
    eq(Object.keys(r.parts.c_pea).join(','), Object.keys(r0.parts.c_pea).join(','), 'mêmes poches pour le compte gardé');
  });

  test('un ancien relevé sans ventilation se convertit en entier, sans perdre un euro', () => {
    Fixture.poser(s => {
      s.monthly = [{ date: '2025-06-01', comment: '', dettes: 100, poches: { cash: 5000 }, v: { c_courant: 3000, c_livret: 2000 } }];
    });
    vrai(ecrireImport({ cible: 'releves', mois: { '2025-06-01': { v: { c_livret: 2200 }, dettes: 50 } } }, { sauver: false }).ok);
    const r = Store.state.monthly[0];
    vrai(!r.poches && !!r.parts && !!r.parts.c_courant, 'ventilation recalculée pour tout le relevé');
    pres(rowTotal(r), 5200, 'brut : 3 000 + 2 200');
    pres(rowNet(r), 5150, 'net : moins la nouvelle dette');
  });

  test('un relevé neuf se crée à sa place, cellule vide absente, zéro déclaré', () => {
    Fixture.poser(s => { s.monthly = [{ date: '2026-03-01', comment: '', v: { c_courant: 1 } }]; });
    const g = lireCSV('Date;Compte courant;Livret\n02/2026;0;\n04/2026;10;20');
    const { lignes } = lignesParMois(g, 1, 0, [null, 'compte:c_courant', 'compte:c_livret']);
    const mois = planParMois(lignes, 'releves');
    eq(JSON.stringify(mois['2026-02-01'].v), JSON.stringify({ c_courant: 0 }), 'zéro déclaré, vide absent');
    vrai(ecrireImport({ cible: 'releves', mois }, { sauver: false }).ok);
    eq(Store.state.monthly.map(r => r.date).join(','), '2026-02-01,2026-03-01,2026-04-01', 'triés');
    vrai(!rowIsEmpty(Store.state.monthly[0]), 'un zéro déclaré n’est pas un relevé vide');
  });
});

suite('Import d’un tableau : la sauvegarde et l’enregistrement', () => {
  /* Les deux echecs se simulent en remplacant, le temps d'un test, la
     sauvegarde et l'ecriture : rien n'atteint le stockage du navigateur. */
  const avec = async ({ sauvegarde, ecriture }, fn) => {
    const ab = Store.addBackup, sv = Store.save;
    Store.addBackup = () => sauvegarde;
    Store.save = function () { this._ecritureKo = !ecriture; };
    try { return await fn(); } finally { Store.addBackup = ab; Store.save = sv; Store._ecritureKo = false; }
  };
  const plan = { cible: 'depenses', forme: 'operations', mois: { '2026-09-01': { v: { Courses: 12 } } } };
  const poser = () => Fixture.poser(s => {
    s.budget.categories = ['Courses'];
    s.budget.expenses = [{ month: '2026-09-01', note: '', v: { Courses: 1 } }];
  });
  const sept = () => Store.state.budget.expenses.find(x => x.month === '2026-09-01').v.Courses;

  test('sans sauvegarde, la question décide : refusée, rien ne change', async () => {
    poser();
    let posee = 0;
    const r = await avec({ sauvegarde: false, ecriture: true },
      () => importerAvecSauvegarde(plan, async () => { posee++; return false; }));
    eq(posee, 1, 'la question est posée');
    eq(r.statut, 'annule'); eq(sept(), 1, 'le mois n’a pas bougé');
  });

  test('sans sauvegarde mais confirmé, l’import se fait', async () => {
    poser();
    const r = await avec({ sauvegarde: false, ecriture: true }, () => importerAvecSauvegarde(plan, async () => true));
    eq(r.statut, 'enregistre'); eq(sept(), 12);
  });

  test('avec sauvegarde, aucune question', async () => {
    poser();
    let posee = 0;
    const r = await avec({ sauvegarde: true, ecriture: true },
      () => importerAvecSauvegarde(plan, async () => { posee++; return false; }));
    eq(posee, 0, 'pas de question'); eq(r.statut, 'enregistre');
  });

  test('un stockage qui refuse l’écriture se dit : « session », jamais « enregistré »', async () => {
    poser();
    const r = await avec({ sauvegarde: true, ecriture: false }, () => importerAvecSauvegarde(plan, async () => true));
    eq(r.statut, 'session', 'écrit en mémoire, pas sur l’appareil');
    eq(sept(), 12);
  });
});

suite('Import d’un tableau : les modèles à remplir', () => {
  /* Une feuille de modele relue comme le lecteur la rendrait : en-tetes en
     texte, dates en date, cellules vides en vide. */
  const grille = f => [
    f.cols.map(c => ({ t: 'texte', v: c.h })),
    ...f.rows.map(r => r.map((v, i) => (v == null ? { t: 'vide', v: null }
      : f.cols[i].t === 'date' ? { t: 'date', v } : typeof v === 'number' ? { t: 'nombre', v } : { t: 'texte', v }))),
  ];
  const enAnglais = fn => { setLang('en'); try { return fn(); } finally { setLang('fr'); } };

  test('le modèle d’opérations se relit, en français comme en anglais', () => {
    for (const lire of [fn => fn(), enAnglais]) {
      lire(() => {
        const f = modeleOperations();
        eq(f.length, 1, 'une seule feuille : l’exemple vit dans la fenêtre');
        const g = grille(f[0]);
        const c = devinerColonnesOperations(g[0], g.slice(1));
        eq(`${c.date},${c.libelle},${c.montant}`, '0,1,2', `date, libellé, montant (${f[0].cols.map(x => x.h).join('/')})`);
        eq(lignesOperations(g, 1, c).lignes.length, 0, 'vide, il n’importe rien');
      });
    }
  });

  test('le modèle par mois porte les catégories du profil telles quelles', () => {
    const cats = ['Courses', 'Restos', 'Sorties du week-end'];
    for (const lire of [fn => fn(), enAnglais]) {
      lire(() => {
        const f = modeleDepensesParMois(cats, '2026')[0];
        eq(f.rows.length, 12, 'douze mois');
        eq(f.cols.slice(1).map(c => c.h).join('|'), cats.join('|'), 'les noms du profil, sans traduction');
        const g = grille(f);
        eq(devinerFormeDepenses(g[0], g.slice(1), cats), 'mois', 'reconnu comme un tableau par mois');
        const { date, colonnes } = devinerColonnesMois(g[0], g.slice(1), cats);
        eq(date, 0);
        eq(colonnes.slice(1).join('|'), cats.join('|'), 'chaque catégorie mappée');
        eq(lignesParMois(g, 1, date, colonnes).lignes.length, 0, 'vide, il n’importe rien');
      });
    }
  });

  test('le modèle de relevés : homonymes, noms réservés et dettes se relisent sans rien à choisir', () => {
    const comptes = [
      { id: 'a1', label: 'Livret', broker: 'Banque Une', legacy: false },
      { id: 'a2', label: 'Livret', broker: 'Banque Une', legacy: false },
      { id: 'a3', label: 'Mois', broker: 'Banque Deux', legacy: false },
      { id: 'a4', label: 'Month', broker: 'Banque Deux', legacy: false },
      { id: 'a5', label: 'Crédits en cours', broker: 'Banque Deux', legacy: false },
      { id: 'a6', label: 'Loan fund', broker: 'Courtier', legacy: false },
      { id: 'a7', label: 'Vieux compte', broker: 'Banque Trois', legacy: true },
    ];
    for (const lire of [fn => fn(), enAnglais]) {
      lire(() => {
        const f = modeleReleves(comptes, '2026-10-07', true)[0];
        eq(f.rows[0][0], '2025-11-01', 'du plus ancien des douze mois');
        eq(f.rows[11][0], '2026-10-01', 'au mois en cours');
        const entetes = f.cols.map(c => c.h);
        vrai(!entetes.some(h => h.startsWith('Vieux compte')), 'un compte clôturé n’a pas de colonne');
        eq(new Set(entetes).size, entetes.length, 'aucun en-tête en double');
        const g = grille(f);
        const c = devinerColonnesReleves(g[0], g.slice(1), comptes);
        eq(c[0], 'date', 'la date reste la date');
        eq(c.slice(1, 7).map(x => x.compte).join(','), 'a1,a2,a3,a4,a5,a6', `chaque compte retrouvé (${entetes.join(' | ')})`);
        eq(c[7], 'dettes', 'et la colonne des crédits');
        eq(blocagesColonnesReleves(g[0], c).length, 0, 'rien à choisir');
        eq(lignesParMois(g, 1, 0, c.map(cleCibleReleve)).lignes.length, 0, 'vide, il ne change rien');
      });
    }
  });

  test('un en-tête complet départage, et un compte n’est jamais une dette', () => {
    const comptes = [
      { id: 'b1', label: 'Loan', broker: 'Banque', legacy: false },
      { id: 'b2', label: 'Loan', broker: 'Autre', legacy: false },
    ];
    const g = lireCSV('Mois;Loan Banque;Outstanding loans\n01/2026;10;5000');
    const c = devinerColonnesReleves(g[0], g.slice(1), comptes);
    eq(c[1].compte, 'b1', '« libellé établissement » désigne un seul compte');
    eq(c[2], 'dettes', 'l’en-tête anglais des dettes se reconnaît');
    const marque = lireCSV('Mois;Ancien [b2];Total dettes [dettes]\n01/2026;1;2');
    const cm = devinerColonnesReleves(marque[0], marque.slice(1), comptes);
    eq(cm[1].compte, 'b2', 'une marque d’identifiant désigne son compte');
    eq(cm[2], 'dettes', 'une marque de dettes aussi');
  });
});

finDePartieDeTests('tests/38-import-tableau.tests.js');
