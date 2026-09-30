partieDeTests('tests/24-chaque-categorie-repartition-s.tests.js');
/* ------------------------------------------------------------------
   Repartition : je touche une categorie, je trouve ce qui la compose,
   je mets a jour
   ------------------------------------------------------------------ */
suite('Chaque catégorie de la répartition s’ouvre, et dit comment la mettre à jour', () => {
  const app = () => lireSource('assets/app.js');
  const css = () => lireSource('assets/styles.css');
  const tranche = (src, debut, fin) => src.slice(src.indexOf(debut), src.indexOf(fin, src.indexOf(debut)));
  const ligne = () => tranche(app(), 'const ligneClasse = x => {', '</button>`; };');
  const panneau = () => tranche(app(), '  classe: (classe) => {', '\n  cible: (cle) =>');

  test('toute la rangée est la cible, et elle le montre', () => {
    const l = ligne();
    vrai(/<button type="button" class="repart-ligne" data-action="apercu"/.test(l), 'la rangée entière est un bouton');
    vrai(/<span class="ml-chev" aria-hidden="true">›<\/span>\s*\n\s*<\/span>/.test(l), 'un chevron à droite, après la part');
    const c = css();
    vrai(/\.repart-synthese \.repart-ligne:active::before \{ opacity: 1; \}/.test(c), 'un fond sous le doigt');
    vrai(/\.repart-synthese \.repart-ligne::before \{[^}]*inset: 1px -8px;[^}]*z-index: -1;/.test(c),
      'qui déborde sans déplacer les filets ni les colonnes');
    vrai(/\.repart-synthese \.repart-ligne \{[^}]*isolation: isolate;/.test(c), 'et reste sous le texte');
    vrai(/\.repart-synthese \.repart-ligne:focus-visible \{ outline: 2px solid var\(--accent\);/.test(c),
      'l’anneau de l’application au clavier');
    /* Le groupe « Autres » porte le meme chevron, au meme endroit : il pivote
       quand le groupe se deplie. */
    vrai(/<span class="ml-chev repart-chev" aria-hidden="true">›<\/span>/.test(app()), 'le groupe aussi, à droite');
    vrai(/\.repart-autres\[aria-expanded="true"\] \.repart-chev \{ transform: rotate\(90deg\); \}/.test(c), 'et il pivote');
  });

  test('un lecteur d’écran entend le nom, le montant, la part, puis le geste', () => {
    const l = ligne();
    vrai(/<span class="hors-ecran">, \$\{dettesSeules \? trad\('voir et mettre à jour tes crédits'\)\s*\n\s*: trad\('voir ce qui compose cette catégorie et la mettre à jour'\)\}<\/span>/.test(l),
      'la fin du libellé n’est lue que par lui');
    vrai(!/aria-label=/.test(l), 'aucun libellé ne remplace le montant, masqué ou non');
    for (const c of ['voir ce qui compose cette catégorie et la mettre à jour', 'voir et mettre à jour tes crédits'])
      vrai(!!I18N.en[c], `« ${c} » a sa traduction`);
  });

  test('la fenêtre nomme le geste : un compte pour les liquidités, un actif ailleurs', () => {
    const p = panneau();
    const blocs = [...p.matchAll(/avant: blocMiseAJour\('(compte|actif)'/g)].map(m => m[1]);
    eq(blocs.join(','), 'compte,actif,actif,actif', 'liquidités, immobilier, actifs de marché, puis tous les autres');
    const liq = tranche(p, "if (classe === 'liquidites')", "if (classe === 'immobilier')");
    vrai(/blocMiseAJour\('compte', trad\('Corrige le solde d’un compte ci-dessous, puis enregistre\.'\)\)/.test(liq),
      'les liquidités se corrigent sur place, compte par compte');
    const b = tranche(app(), 'function blocMiseAJour(', '\n}\n');
    vrai(/trad\(genre === 'compte' \? 'Mettre à jour un compte' : 'Mettre à jour un actif'\)/.test(b), 'les deux libellés demandés');
    vrai(!/data-action|<button|<input/.test(b), 'le bloc explique, il ne fait rien lui-même');
  });

  test('le total d’une catégorie se dit calculé, et ne se modifie pas', () => {
    const p = panneau();
    eq((p.match(/calcule: true,/g) || []).length, 4, 'les quatre fenêtres de catégorie');
    vrai(/\$\{a\.calcule \? `\$\{trad\('Total calculé'\)\} · ` : ''\}/.test(app()), 'la note le dit');
    const o = tranche(app(), 'function openApercu(', "$('#modalFoot').innerHTML");
    vrai(/<div class="modal-total"><b>\$\{a\.totalTexte \|\| fmtEUR\(a\.total\)\}<\/b>/.test(o), 'le total reste un chiffre, sans champ');
    vrai(/\$\{a\.avant \|\| ''\}/.test(o) && o.indexOf("${a.avant || ''}") > o.indexOf('modal-total'),
      'et le geste suit le total, avant la liste');
    vrai(!!I18N.en['Total calculé'], 'dans les deux langues');
  });

  test('chaque placement est une rangée qui mène là où sa valeur se corrige', () => {
    const p = panneau();
    vrai(/html: lignesActifs\(lignes, montrer\),/.test(p), 'la liste des placements est celle des actifs');
    vrai(/\.\.\.\(i >= 0 \? \{ ouvre: \{ action: 'open-position', i \} \}\s*\n\s*: \{ route: `#\/compte\/\$\{encodeURIComponent\(c\.id\)\}` \}\)/.test(p),
      'une ligne cotée ouvre sa position, les autres la fiche de leur compte');
    const f = tranche(app(), 'function lignesActifs(', '\n}\n');
    vrai(/<button type="button" class="mlist/.test(f), 'une rangée de liste, entière');
    vrai(/data-action="\$\{esc\(l\.ouvre\.action\)\}" data-i=/.test(f) && /data-action="aller-fiche" data-route=/.test(f),
      'avec les deux chemins');
    vrai(/<span class="ml-chev" aria-hidden="true">›<\/span>/.test(f), 'son chevron');
    vrai(/<span class="hors-ecran">, \$\{trad\('ouvrir sa fiche pour le mettre à jour'\)\}<\/span>/.test(f),
      'et ce que fait le geste, pour un lecteur d’écran');
    vrai(/#modalBody\.tout-voir \.mlist\.apercu-surplus \{ display: flex; \}/.test(css()), 'le repli vaut aussi pour ces rangées');
    vrai(/\.apercu-actifs \.mlist:focus-visible \{ outline: 2px solid var\(--accent\);/.test(css()), 'avec l’anneau au clavier');
  });

  test('les champs et les boutons de la fenêtre ont un nom', () => {
    const p = panneau();
    vrai(/aria-label="\$\{esc\(trad\('Solde, \{c\}'\)\.replace\('\{c\}', nomCompteV2\(x\.c\)\)\)\}"/.test(p),
      'le solde de chaque compte se nomme');
    vrai(/aria-label="\$\{esc\(trad\('Mettre à jour \{n\}'\)\.replace\('\{n\}', nomCompteV2\(b\.compte\)\)\)\}"/.test(p),
      'le bouton de chaque bien aussi, et il se traduit');
    vrai(/>\$\{trad\('Mettre à jour ce bien'\)\} →<\/button>/.test(p), 'et dit ce qu’il fait');
    vrai(!/aria-label="Ouvrir la fiche de/.test(app()), 'plus de libellé français en dur');
    vrai(!I18N.en['Ouvrir la fiche →'], 'et l’ancien libellé est parti du dictionnaire');
  });

  test('ce qui s’affichait sans traduction se traduit', () => {
    const p = panneau();
    vrai(/trad\(lignes\.length > 1 \? '\{n\} placements' : '\{n\} placement'\)/.test(p), 'le nombre de placements');
    vrai(!/placement\$\{lignes\.length > 1/.test(p), 'plus de pluriel écrit à la main');
    vrai(/cta: trad\(surMarche \? 'Ouvrir Marchés' : 'Ouvrir Actifs'\)/.test(p), 'et le bouton du pied');
    /* La fenetre de l'immobilier portait son titre en francais dans les deux
       langues, sous une ligne qui disait « Property ». */
    vrai(/titre: CLASSES_ACTIFS\.immobilier,/.test(p) && !/titre: 'Immobilier'/.test(p), 'le titre de l’immobilier aussi');
    for (const c of ['Mettre à jour un compte', 'Mettre à jour un actif', 'ouvrir sa fiche pour le mettre à jour', 'Solde, {c}',
                     'Corrige le solde d’un compte ci-dessous, puis enregistre.', 'Mettre à jour {n}', 'Mettre à jour ce bien',
                     'Ouvre la fiche d’un bien pour corriger sa valeur.', 'Le capital restant dû se corrige ici même.',
                     'Les cours s’actualisent dans Marchés. Ouvre une ligne pour corriger sa quantité ou son prix de revient.',
                     'Touche un actif pour ouvrir sa fiche et corriger sa valeur.', '{n} placements', '{n} placement'])
      vrai(!!I18N.en[c], `« ${c.slice(0, 40)} » a sa traduction`);
    for (const [c, m] of [['Solde, {c}', '{c}'], ['Mettre à jour {n}', '{n}'], ['{n} placements', '{n}']])
      vrai(I18N.en[c].includes(m), `« ${c} » garde ${m}`);
  });
});

/* ------------------------------------------------------------------
   Mettre a jour sans hesiter : le geste et sa validation, ensemble
   ------------------------------------------------------------------
   Tout s'ecrit a la frappe, et « Enregistrer » ne fait que confirmer et
   reposer le point de retour d'« Annuler ». Mais sur un telephone, le bouton
   se trouvait un ecran plus bas que le champ, et l'on partait sans savoir si
   le chiffre etait pris. La barre suit desormais le champ qu'on revient
   corriger chaque mois ; la liste « À mettre a jour » d'Actifs mene au bon
   compte et au bon champ ; un bien porte ses deux chiffres qui bougent en tete
   de fiche ; et une estimation ne se presente plus comme un prix de vente. */
suite('Mettre à jour sans hésiter : le geste et sa validation, ensemble', () => {
  const app = () => lireSource('assets/app.js');
  const store = () => lireSource('assets/store.js');
  const ilYA = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const tout = s => {
    for (const c of s.comptes) for (const l of c.lignes) l.estimeLe = todayISO();
    for (const c of s.comptes) for (const e of c.cash) e.saisiLe = todayISO();
    for (const e of s.etabs) for (const d of e.dettes) d.verifieLe = todayISO();
  };

  test('ce qui se met à jour à la main se liste, avec sa date ou sans', () => {
    Fixture.poser();
    const liste = valeursARevoir();
    vrai(liste.length > 0, 'la graine d’essai porte des valeurs sans date');
    vrai(!liste.some(x => x.genre === 'cours'),
      'les cours n’y sont pas : ils s’actualisent, ils ne se ressaisissent pas');
    for (const x of liste) {
      vrai(/^#\/(compte|etab)\//.test(x.route), `${x.nom} mène à une fiche`);
      vrai(['solde', 'estimation', 'credit'].includes(x.ancre), `${x.nom} vise une carte`);
      vrai(x.date === null || /^\d{4}-\d{2}-\d{2}/.test(x.date), 'une date, ou null : jamais autre chose');
    }
    const soldes = liste.filter(x => x.genre === 'solde');
    vrai(soldes.length >= 2 && soldes.every(x => x.compteId && x.route === '#/compte/' + x.compteId),
      'un solde par compte, chacun avec sa propre fiche');
    vrai(liste.some(x => x.genre === 'estimation' && x.compteId === 'c_immo' && x.date === null),
      'l’estimation sans date du studio');
    const credit = liste.find(x => x.genre === 'credit');
    vrai(credit && credit.date === null, 'un crédit jamais vérifié');
    eq(credit.route, '#/compte/c_immo', 'et il mène au compte qu’il finance');
    eq(credit.ancre, 'credit', 'sur la carte du capital');
  });

  test('tout ce qui est frais disparaît ; un solde vieux revient avec sa date, devant les datés', () => {
    Fixture.poser(tout);
    eq(valeursARevoir().length, 0, 'rien à revoir');
    Fixture.poser(s => {
      tout(s);
      s.comptes.find(c => c.id === 'c_courant').cash[0].saisiLe = ilYA(40);
      s.comptes.find(c => c.id === 'c_livret').cash[0].saisiLe = ilYA(3);
    });
    const l = valeursARevoir();
    eq(l.length, 1, 'un seul solde vieux : celui de la semaine ne se réclame pas');
    eq(l[0].compteId, 'c_courant', 'le compte courant');
    eq(l[0].date, ilYA(40), 'avec sa vraie date');
    Fixture.poser(s => {
      tout(s);
      s.comptes.find(c => c.id === 'c_courant').cash[0].saisiLe = ilYA(40);
      s.comptes.find(c => c.id === 'c_livret').cash[0].saisiLe = ilYA(90);
      delete s.comptes.find(c => c.id === 'c_pea').cash[0].saisiLe;
    });
    eq(valeursARevoir().map(x => x.compteId).join(), 'c_pea,c_livret,c_courant',
      'les sans date d’abord, puis du plus ancien au plus récent');
  });

  test('la liste d’avant relevé se dérive de la même source', () => {
    Fixture.poser(s => { s.comptes.find(c => c.id === 'c_courant').cash[0].saisiLe = ilYA(40); });
    const a = aRafraichir(), v = valeursARevoir();
    eq(a.filter(x => x.genre === 'solde').length, v.filter(x => x.genre === 'solde' && x.date).length,
      'les soldes vieux, un par un');
    eq(a.find(x => x.genre === 'soldesSansDate').noms.length, v.filter(x => x.genre === 'solde' && !x.date).length,
      'les sans date, regroupés en une entrée');
    eq(a.filter(x => x.genre === 'estimation').length, v.filter(x => x.genre === 'estimation').length, 'les estimations');
    eq(a.filter(x => x.genre === 'credit').length, v.filter(x => x.genre === 'credit').length, 'les crédits');
    const src = store();
    vrai(/for \(const x of valeursARevoir\(\)\)/.test(src.slice(src.indexOf('function aRafraichir'))),
      'aRafraichir lit valeursARevoir au lieu de refaire les seuils');
  });

  test('un crédit sans compte financé mène à son établissement', () => {
    Fixture.poser(s => {
      s.etabs.find(e => e.id === 'e_banque').dettes.push({ id: 'd_conso', libelle: 'Prêt conso', montant: 5000, note: '' });
    });
    const x = valeursARevoir().find(y => y.genre === 'credit' && y.nom === 'Prêt conso');
    vrai(x, 'il se liste');
    eq(x.compteId, null, 'deux comptes chez cette banque : aucun ne le porte');
    eq(x.route, '#/etab/e_banque', 'donc la fiche de l’établissement');
    vrai(/<div class="card" data-anchor="credit">\s*<div class="card-head"><h2>\$\{trad\('Crédits en cours'\)\}/.test(app()),
      'où la carte des crédits porte l’ancre');
  });

  test('la barre de validation ferme la carte du solde, et la liste mène au champ', () => {
    const s = app();
    vrai(/<div class="card" data-anchor="solde">/.test(s), 'la carte du solde porte son ancre');
    vrai(/cash\.\$\{i\}\.montant" value="\$\{num\(e\.montant\)\}"\$\{i \? '' : ' data-anchor-focus'\}/.test(s),
      'et son premier champ prend le curseur');
    const carteSolde = s.slice(s.indexOf('<div class="card" data-anchor="solde">'));
    vrai(/trad\('dernière vérification le \{d\}'\)/.test(carteSolde.slice(0, 3000))
      && /trad\('solde jamais vérifié'\)/.test(carteSolde.slice(0, 3000)),
      'chaque part dit de quand date son solde, ou qu’il n’a jamais été vérifié');
    const af = s.slice(s.indexOf("'aller-fiche'(btn)"), s.indexOf("'aller-fiche'(btn)") + 400);
    vrai(/pendingAnchor = btn\.dataset\.anchor \|\| null;/.test(af) && /pendingFocus = btn\.dataset\.focus === '1';/.test(af),
      'aller-fiche porte l’ancre et le curseur');
    const fa = s.slice(s.indexOf('function focusAnchor'), s.indexOf('function render()'));
    vrai(/if \(pendingFocus\) \{[\s\S]{0,300}\[data-anchor-focus\][\s\S]{0,200}focus\(\{ preventScroll: true \}\)/.test(fa),
      'focusAnchor pose le curseur dans le champ marqué, sans second geste');
    const carte = s.slice(s.indexOf('function carteValeursARevoir'), s.indexOf('function viewAccounts'));
    vrai(/data-action="aller-fiche" data-route="\$\{esc\(x\.route\)\}" data-anchor="\$\{esc\(x\.ancre\)\}" data-focus="1"/.test(carte),
      'chaque ligne de la liste ouvre la fiche, la carte et le champ');
    vrai(/trad\('solde jamais vérifié'\)/.test(carte) && /trad\('solde vérifié le \{d\}'\)/.test(carte)
      && /trad\('capital restant dû jamais vérifié'\)/.test(carte) && /trad\('estimation sans date'\)/.test(carte),
      'sans date et vieux ne se disent pas pareil, pour chaque nature');
    const vA = s.slice(s.indexOf('function viewAccounts('));
    const ordre = ['${sansCompte || filtre ? \'\' : carteValeursARevoir()}', '<div class="cpt-liste">',
                   "carteInsights('accounts'"].map(m => vA.indexOf(m));
    vrai(ordre.every((n, k) => n > 0 && (!k || n > ordre[k - 1])),
      `sur Actifs : ce qui est à mettre à jour, les comptes, puis « À retenir » : ${ordre.join(' < ')}`);
    vrai(/k >= REVOIR_VISIBLES \? ' revoir-surplus' : ''/.test(carte) && /data-action="revoir-tout"/.test(carte),
      'trois lignes, le reste derrière un bouton');
    const css = lireSource('assets/styles.css');
    vrai(/\.revoir \.revoir-surplus \{ display: none; \}/.test(css) && /\.revoir\.ouvert \.revoir-surplus \{ display: flex; \}/.test(css),
      'que le style replie sans re-rendre');
  });

  test('sur un bien, les deux chiffres qui bougent vivent en tête, et nulle part ailleurs', () => {
    const s = app();
    const espace = s.slice(s.indexOf('function espaceBien'), s.indexOf('function barreValiderFiche'));
    const iMaj = espace.indexOf("<h2>${trad('Mettre à jour')}</h2>");
    const iBien = espace.indexOf("<h2>${trad('Le bien')}</h2>");
    vrai(iMaj > 0 && iBien > iMaj, 'la carte « Mettre à jour » précède « Le bien »');
    eq((espace.match(/data-path="comptes\.\$\{idx\}\.lignes\.\$\{i\}\.valeur"/g) || []).length, 1,
      'la valeur estimée ne s’écrit qu’une fois');
    eq((espace.match(/data-path="comptes\.\$\{idx\}\.lignes\.\$\{i\}\.estimeLe"/g) || []).length, 1, 'sa date aussi');
    eq((s.match(/data-path="etabs\.\$\{idxEtab\}\.dettes\.\$\{i\}\.montant"/g) || []).length, 1,
      'le capital restant dû ne s’écrit qu’une fois sur la fiche d’un bien');
    vrai(espace.indexOf('dettes.${i}.montant') < iBien, 'et c’est dans la carte de tête');
    vrai(/data-path="etabs\.\$\{idxEtab\}\.dettes\.\$\{i\}\.verifieLe"/.test(espace), 'avec sa date de vérification');
    vrai(/trad\('capital restant dû jamais vérifié'\)/.test(espace.slice(iMaj, iBien)), 'qui dit son absence');
    const credit = s.slice(s.indexOf('function carteCredit'), s.indexOf('function espaceBien'));
    vrai(!/dettes\.\$\{i\}\.montant"/.test(credit), 'la carte du crédit ne propose plus le capital en saisie');
    vrai(/<div class="card" data-anchor="estimation">/.test(espace) && /data-anchor="credit"/.test(espace),
      'les deux ancres de la liste sont posées');
    vrai(espace.slice(iMaj, iBien).includes("${barreValiderFiche('accounts', 'bien', { credits: dettes.length })}"), 'et la barre ferme cette carte-là');
  });

  test('le pays de contexte suit la devise choisie, puis la langue', () => {
    Fixture.poser(s => { s.meta.devise = 'USD'; s.meta.deviseChoisie = true; });
    eq(paysContexte(), 'us', 'en dollars, le contexte est américain');
    const rub = typesCompteParRubrique();
    const dans = t => (rub.find(([x]) => x === t) || [null, []])[1].map(([id]) => id);
    eq(dans('Retraite et épargne avantagée').join(), 'us401k,traditionalIra,rothIra,hsa');
    eq(dans('Investissements').join(), 'cto,crypto');
    eq(dans('Autres pays').join(), 'pel,pea,av,per,pee,pereco,scpi', 'les enveloppes françaises restent accessibles, une rubrique plus bas');
    eq(rub.reduce((n, [, l]) => n + l.length, 0), typesCompteChoix().length, 'rien ne se perd');
    Fixture.poser(s => { s.meta.devise = 'EUR'; s.meta.deviseChoisie = false; });
    const fr = String(currentLang() || '').toLowerCase().startsWith('fr');
    eq(paysContexte(), fr ? 'fr' : 'us', 'avant le choix de la devise, la langue décide');
    for (const t of TYPES_COMPTE) vrai(!t.pays || ['fr', 'us'].includes(t.pays), `${t.id} : un pays connu, ou aucun`);
    eq(TYPES_COMPTE.filter(t => t.pays === 'fr').map(t => t.id).join(), 'pel,pea,av,per,pee,pereco,scpi');
    eq(TYPES_COMPTE.filter(t => t.pays === 'us').map(t => t.id).join(), 'us401k,traditionalIra,rothIra,hsa');
    vrai(!!I18N.en['Autres pays'], 'la rubrique se traduit');
  });

  test('sur Actifs, un niveau ne se répète pas, et des espèces à zéro ne font pas un groupe', () => {
    const s = app();
    vrai(/ligneCompte\(c, false, siens\.length === 1 && nomCompteV2\(c\) === e\.nom\)/.test(s),
      'l’unique compte au nom de son établissement se présente par son type');
    vrai(/function ligneCompte\(c, avecEtab = true, nomRepete = false\)/.test(s)
      && /nomRepete \? trad\(typeCompte\(c\.type\)\.label\) : nomCompteV2\(c\)/.test(s), 'la ligne sait le faire');
    const branche = s.slice(s.indexOf("compteVue === 'banque'"), s.indexOf("compteVue === 'type'"));
    vrai(/sansContenant\.every\(c => typeCompte\(c\.type\)\.interne && !valeurCompte\(c\)\)/.test(branche),
      'des espèces internes à zéro, seules, sont reconnues');
    vrai(/sansContenant\.length && !especesSeules/.test(branche), 'et ne font pas le groupe « Sans intermédiaire »');
    vrai(/data-action="fiche-compte"\s*data-id="\$\{esc\(sansContenant\[0\]\.id\)\}"/.test(branche), 'mais gardent leur porte');
    vrai(/enveloppeGroupes\(enDirect\) \+ especesVides/.test(branche), 'en fin de liste');
    for (const k of ['rien de déclaré', 'Déclarer des espèces']) vrai(!!I18N.en[k], k + ' se traduit');
  });

  test('une estimation n’est pas un prix de vente, et les mots le disent', () => {
    const s = app();
    const d = s.slice(s.indexOf('function detailsPlacement'), s.indexOf('\n}', s.indexOf('function detailsPlacement')));
    vrai(/estValeurEstimee\(t\)\s*\? trad\('Valeur estimée'\)/.test(d), 'la carte dit « Valeur estimée » quand c’en est une');
    vrai(/trad\('estimée le \{d\}'\)/.test(d) && /trad\('estimation sans date'\)/.test(d), 'avec sa date, ou son absence');
    vrai(/<div class="card" data-anchor="estimation">/.test(d), 'et porte l’ancre de la liste');
    for (const k of ['Valeur estimée', 'Coût d’achat', 'Mettre à jour', 'ce qui vieillit', 'À mettre à jour',
      'ton estimation du jour : ce n’est pas un prix de vente, le produit réel se saisit à la cession',
      'Ton estimation, pas un prix de vente : ce que tu encaisserais vraiment ne se connaît qu’à la cession, et « Céder » l’enregistre.',
      'Chaque chiffre tapé est déjà enregistré : « Enregistrer » le confirme et le date du jour, « Annuler » revient au dernier état enregistré.',
      'Les deux chiffres qui bougent : ce que vaut le bien, et ce qu’il reste à rembourser. « Enregistrer » les date du jour, même inchangés.',
      'C’est ici que tu mets à jour le solde.',
      'Des soldes, des estimations et des capitaux restant dus qui datent ou n’ont pas de date. Touche une ligne pour ouvrir le champ.',
      '{n} valeurs saisies à la main', '{n} valeur saisie à la main'])
      vrai(!!I18N.en[k], `« ${k.slice(0, 40)} » a sa traduction`);
  });
});

/* ------------------------------------------------------------------
   Enregistrer date le montant de son formulaire
   ------------------------------------------------------------------
   Appuyer sur Enregistrer dans la carte du solde, dans la carte Mettre a jour
   d'un bien, dans la fenetre d'un placement ou celle d'un credit dit que ce
   chiffre est bon aujourd'hui, montant change ou non. Les autres formulaires
   (nom, notes, informations) ne datent rien, Annuler non plus, et une date
   posee a la main gagne. */
suite('« Enregistrer » date le montant de son formulaire, et lui seul', () => {
  const app = () => lireSource('assets/app.js');
  const jour = '2026-09-25';

  test('la carte du solde date chaque part du jour, montant inchangé compris', () => {
    Fixture.poser(s => {
      const cc = s.comptes.find(c => c.id === 'c_courant');
      cc.cash = [{ montant: 3000, affectation: 'courant' },
                 { montant: 500, affectation: 'precaution', saisiLe: '2026-01-05' }];
    });
    const c = compteById('c_courant');
    const releves = JSON.stringify(Store.state.monthly);
    const montants = c.cash.map(e => e.montant).join();
    eq(confirmerSolde(c, jour), 2, 'deux parts datées');
    eq(c.cash.map(e => e.saisiLe).join(), `${jour},${jour}`, 'la part sans date et la part ancienne, toutes deux du jour');
    eq(c.cash.map(e => e.montant).join(), montants, 'aucun montant ne bouge');
    eq(JSON.stringify(Store.state.monthly), releves, 'aucun relevé ne bouge');
    const autre = compteById('c_livret');
    vrai(!autre.cash[0].saisiLe, 'le compte voisin n’est pas daté');
    confirmerSolde(c);
    vrai(!valeursARevoir().some(x => x.compteId === 'c_courant' && x.genre === 'solde'),
      'daté du jour, le solde sort de « À mettre à jour »');
    vrai(!aRafraichir().some(x => x.genre === 'soldesSansDate' && x.noms.includes('Compte courant')),
      'et de la liste d’avant relevé');
  });

  test('la carte « Mettre à jour » d’un bien date l’estimation et le capital, et respecte une date posée à la main', () => {
    Fixture.poser(s => {
      s.etabs.find(e => e.id === 'e_banque').dettes.push({ id: 'd_conso', libelle: 'Prêt conso', montant: 5000, note: '' });
    });
    const c = compteById('c_immo');
    const inst = instantaneFiche('compte:c_immo');
    const valeur = c.lignes[0].valeur, capital = etabById('e_bien').dettes[0].montant;
    eq(confirmerBien(c, inst, jour), 2, 'une estimation et un capital datés');
    eq(c.lignes[0].estimeLe, jour, 'l’estimation, jamais datée, l’est du jour');
    eq(etabById('e_bien').dettes[0].verifieLe, jour, 'le capital restant dû aussi');
    eq(c.lignes[0].valeur, valeur, 'la valeur ne bouge pas');
    eq(etabById('e_bien').dettes[0].montant, capital, 'le capital non plus');
    vrai(!etabById('e_banque').dettes[0].verifieLe, 'un crédit d’un autre établissement reste tel quel');
    /* Une date ecrite a la main pendant la visite gagne : elle differe de
       l'instantane, et « Enregistrer » la laisse. */
    const inst2 = instantaneFiche('compte:c_immo');
    c.lignes[0].estimeLe = '2026-03-01';
    eq(confirmerBien(c, inst2, '2026-09-26'), 1, 'seul le capital se redate');
    eq(c.lignes[0].estimeLe, '2026-03-01', 'la date posée à la main reste');
    eq(etabById('e_bien').dettes[0].verifieLe, '2026-09-26', 'le capital, lui, passe au jour');
    vrai(!valeursARevoir().some(x => x.genre === 'credit' && x.nom === 'Prêt immobilier'),
      'et il sort de « À mettre à jour »');
  });

  test('seules les barres des montants portent la date, et « Annuler » ne date rien', () => {
    const s = app();
    eq((s.match(/barreValiderFiche\('accounts', \(c\.cash \|\| \[\]\)\.length \? 'solde' : '', \{ parts: \(c\.cash \|\| \[\]\)\.length \}\)/g) || []).length, 1, 'la carte du solde, qui ne date que si elle porte une part');
    eq((s.match(/barreValiderFiche\('accounts', 'bien', \{ credits: dettes\.length \}\)/g) || []).length, 1, 'la carte « Mettre à jour » d’un bien');
    eq((s.match(/barreValiderFiche\(\)/g) || []).length, 2,
      'les informations d’un compte et les notes d’un établissement, sans date');
    const fn = s.slice(s.indexOf('function barreValiderFiche'), s.indexOf("/* L'etat d'une fiche a son ouverture"));
    vrai(/\$\{dater \? ` data-dater="\$\{esc\(dater\)\}"` : ''\}/.test(fn), 'le bouton ne porte la marque que s’il date');
    const action = s.slice(s.indexOf("'enregistrer-fiche'(btn)"), s.indexOf("async 'supprimer-compte'"));
    vrai(/const dater = btn && btn\.dataset \? btn\.dataset\.dater : '';/.test(action), 'l’action lit la marque');
    vrai(/if \(compte && dater === 'solde'\) confirmerSolde\(compte\);/.test(action)
      && /if \(compte && dater === 'bien'\) confirmerBien\(compte, ficheAvant\);/.test(action),
      'et date le montant de la carte, en comparant à l’instantané pour le bien');
    vrai(action.indexOf('confirmerSolde') < action.indexOf('Store.save()'), 'avant d’enregistrer');
    const annuler = s.slice(s.indexOf("async 'annuler-fiche'(btn)"), s.indexOf("'enregistrer-fiche'(btn)"));
    vrai(!/confirmer|todayISO/.test(annuler), '« Annuler » ne date rien');
    const modifier = s.slice(s.indexOf("async 'modifier-compte'(btn)"), s.indexOf("async 'modifier-compte'(btn)") + 6000);
    vrai(!/saisiLe|estimeLe|verifieLe/.test(modifier.replace(/\/\*[\s\S]*?\*\//g, '')),
      'la fenêtre du nom, du type et des dates du compte ne touche à aucune date de montant');
    vrai(/trad\('Soldes jamais vérifiés'\)/.test(s) && /trad\('solde vérifié le \{d\}'\)/.test(s),
      'un solde se dit désormais « vérifié le »');
    vrai(!/saisi le \{d\}|sans date de saisie/.test(s.replace(/\/\*[\s\S]*?\*\//g, '')), 'et plus jamais « saisi le »');
  });
});

/* ------------------------------------------------------------------
   Audit de la partie compte
   ------------------------------------------------------------------
   Quatre constats d'une relecture exterieure, et l'assertion qui aurait
   attrape chacun avant elle. */
suite('Audit de la partie compte : quatre constats', () => {
  const app = () => lireSource('assets/app.js');
  const parcoursCreation = () => {
    const s = app();
    const d = s.indexOf("async 'ajouter-compte'");
    return s.slice(d, s.indexOf("'fiche-compte'(btn)", d));
  };

  test('un bien de valeur ne se voit demander ni usage, ni quote-part, ni frais de notaire', () => {
    /* Le drapeau `direct` dit « on le detient soi-meme », et une montre le
       porte autant qu'un appartement. Mais une montre ne s'habite pas, n'a pas
       de frais de notaire, et sa fiche ne propose ensuite qu'un montant investi. */
    vrai(estImmoEnDirect(typeCompte('immo')), 'un logement détenu en direct');
    vrai(!estImmoEnDirect(typeCompte('bienValeur')), 'pas une montre, même détenue en direct');
    vrai(!estImmoEnDirect(typeCompte('scpi')), 'ni une SCPI');
    eq(estBienEnDirect({ type: 'immo' }), true, 'la question posée au compte passe par la même porte');
    eq(estBienEnDirect({ type: 'bienValeur' }), false);
    const p = parcoursCreation();
    vrai(/const immoDirect = bien && estImmoEnDirect\(t\);/.test(p), 'le parcours pose la question au type');
    vrai(/\.\.\.\(immoDirect \? \[\s*\{ cle: 'section_acq'/.test(p), 'les trois coûts du logement');
    vrai(/\.\.\.\(immoDirect \? \[\{ cle: 'usageBien'/.test(p), 'l’usage');
    vrai(/\.\.\.\(immoDirect \? \[\{ cle: 'part'/.test(p), 'la quote-part');
    vrai(/\.\.\.\(!immoDirect \? \[\] : \[\s*\{ cle: 'apport'/.test(p), 'l’apport');
    vrai(!/bien && estDetenuEnDirect\(t\)/.test(p),
      'et plus aucun champ du parcours ne se pose sur le seul drapeau direct');
  });

  test('corriger le montant investi d’un bien de valeur change son coût', () => {
    /* Une montre creee avant ce correctif porte un detail complet, et sa fiche
       ne propose que « Montant investi » : le champ arrivait vide, et ce qu'on y
       tapait n'etait jamais lu. */
    const l = { id: 'l', classe: 'bienValeur', libelle: 'Montre', valeur: 9000,
                prixAchat: 6000, fraisAcquisition: 200, travauxInitiaux: 0 };
    pres(coutAcquisition(l), 6200, 'le détail complet fait le coût');
    const src = app();
    const champs = src.slice(src.indexOf('function champsPlacement('), src.indexOf('function litPlacement('));
    vrai(/valeur: l && coutAcquisition\(l\) !== null \? coutAcquisition\(l\) : '',/.test(champs),
      'le formulaire montre le coût effectif, pas le seul champ legacy');
    const lit = src.slice(src.indexOf('function litPlacement('), src.indexOf('function creditsRattachables('));
    vrai(/tape !== coutAcquisition\(base\)/.test(lit) && /for \(const k of DETAIL\) delete ligne\[k\];/.test(lit),
      'et un montant tapé par-dessus efface le détail, pour être lu');
    vrai(/estDeclare\(v\.prixDeRevient\) \? num\(v\.prixDeRevient\) : null/.test(lit),
      'un zéro tapé est une déclaration : comparé au coût, pas rangé parmi les vides');
  });

  test('deux lots dont un seul a un coût : le compte n’a pas de coût total', () => {
    Fixture.poser(s => {
      const c = s.comptes.find(x => x.id === 'c_immo');
      c.lignes.push({ id: 'l_park', classe: 'immobilier', libelle: 'Parking',
                      valeur: 15000, quantite: 1, dateAcquisition: '' });
    });
    const c = compteById('c_immo');
    const a = acquisitionCompte(c);
    eq(a.lots, 2); eq(a.connus, 1);
    eq(a.sansCout, 1, 'un lot ne dit rien de son coût');
    eq(a.total, null, 'le prix du studio n’est pas le coût du bien entier');
    eq(planFinancement(c), null, 'et aucun écart de financement ne se calcule sur une base amputée');
    c.lignes[1].prixDeRevient = 12000;
    const b = acquisitionCompte(c);
    pres(b.total, 122000, 'les deux coûts connus font le total');
    eq(b.sansCout, 0);
    vrai(planFinancement(c) !== null, 'et le plan de financement redevient calculable');
    const carte = app().slice(app().indexOf('function carteAcquisition('), app().indexOf('function blocFinancementInitial('));
    vrai(/acq\.sansCout/.test(carte), 'la carte dit combien de lots manquent');
  });

  test('un lot déclaré et un lot muet : pas d’usage de compte, et le lot à préciser', () => {
    const bien = usages => Fixture.poser(s => {
      s.etabs = [{ id: 'e_bq', nom: 'Banque', notes: '', dettes: [] }];
      s.comptes = [{ id: 'c_b', etabId: 'e_bq', type: 'immo', statut: 'ouvert', libelle: 'Appartement',
        cash: [], lignes: usages.map((u, i) => ({ id: 'l' + i, classe: 'immobilier',
          libelle: 'Lot ' + i, valeur: 100000, ...(u ? { usage: u } : {}) })) }];
      s.positions = []; s.monthly = [];
      s.budget.income = []; s.budget.fixedCharges = [];
    });
    for (const dit of ['principale', 'locative']) {
      bien([dit, '']);
      const u = usageEffectifBien(compteById('c_b'));
      eq(u.usage, '', `${dit} + absent : le compte n’a pas d’usage`);
      eq(u.source, 'partiel', 'et dit pourquoi');
      eq(u.action, 'lots', 'la fiche renvoie vers chaque lot, sans bouton global');
      eq(u.aPreciser, 1, 'un lot à préciser');
      eq(compteById('c_b').lignes[0].usage, dit, 'l’usage déclaré n’a pas bougé');
      eq(compteById('c_b').lignes[1].usage, undefined, 'et le muet reste muet : rien n’est inventé');
    }
    /* Deux lots d'accord, et un seul lot muet, gardent leurs reponses d'avant. */
    bien(['principale', 'principale']);
    eq(usageEffectifBien(compteById('c_b')).usage, 'principale');
    bien(['']);
    eq(usageEffectifBien(compteById('c_b')).action, 'choisir', 'un seul lot muet se demande au compte');
    const src = app();
    const fiche = src.slice(src.indexOf('const DEMANDES = {'), src.indexOf('const q = DEMANDES['));
    vrai(/partiel: \{ titre: 'Usage à préciser sur un lot'/.test(fiche), 'le bandeau nomme le manque');
    vrai(/const q = DEMANDES\[u\.source === 'partiel' \? 'partiel' : u\.action\];/.test(src),
      'et il est choisi sur la source');
    const choisir = src.slice(src.indexOf("async 'choisir-usage'(btn)"),
                              src.indexOf("async 'choisir-usage'(btn)") + 1500);
    vrai(/if \(u\.action === 'lots'\) return;/.test(choisir),
      'le choix global refuse d’écraser un usage déjà déclaré');
    vrai(I18N.en['Usage à préciser sur un lot'], 'traduit');
  });

  test('céder sans prix de revient connu ne fabrique aucune plus-value', () => {
    const poserSansCout = lignePlus => Fixture.poser(s => {
      s.comptes.push({
        id: 'c_parts', etabId: 'e_pe', type: 'pe', statut: 'ouvert',
        ouvertLe: '2024-01-01', numero: '', notes: '',
        libelle: 'Participation', court: 'Participation', alloc: '', cash: [],
        lignes: [{ id: 'l_parts', classe: 'nonCote', libelle: 'Participation',
                   parts: 4000, valeur: 12000, dateAcquisition: '2024-01-01', ...lignePlus }],
      });
    });
    poserSansCout({});
    const cashAvant = valeurCompte(compteById('c_courant'));
    const a = cederPlacement({ compteId: 'c_parts', index: 0, parts: 1000, produit: 3300,
                               cashAccount: 'c_courant', cashPart: partieSuggeree('c_courant', { credit: true }), date: '2026-09-20' });
    vrai(a, 'la cession passe : le produit est un fait, même sans base');
    eq(a.investi, null, 'l’investi est inconnu');
    eq(a.realised, null, 'donc le résultat aussi');
    eq(a.pct, null);
    pres(a.produit, 3300, 'le produit se dit');
    pres(a.sortie, 3000, 'et la valeur qui sort du patrimoine aussi');
    pres(valeurCompte(compteById('c_courant')), round2(cashAvant + 3300), 'le cash est crédité');
    const v = Store.state.sales[0];
    eq(v.invested, null, 'le journal garde l’inconnue'); eq(v.realised, null); eq(v.buyPrice, null);
    pres(num(v.gross), 3300, 'et le produit');
    pres(statsDesVentes([v]).realised, 0, 'les totaux du journal ne comptent rien pour elle');
    pres(num(compteById('c_parts').lignes[0].parts), 3000, 'les parts restantes');

    /* Un cout nul DECLARE, lui, est un cout : tout le produit est alors gagne. */
    poserSansCout({ prixAchat: 0, fraisAcquisition: 0, travauxInitiaux: 0 });
    const b = apercuCession(compteById('c_parts').lignes[0], typeCompte('pe'), { parts: 1000, produit: 3300 });
    pres(b.investi, 0, 'zéro déclaré vaut zéro');
    pres(b.realised, 3300, 'et le produit entier est la plus-value');

    /* Les ecrans qui lisent le resultat savent se taire. */
    const src = app();
    vrai(/trad\('non calculable'\)/.test(src.slice(src.indexOf('function lignesJournalVentes('), src.indexOf('function lignesJournalVentes(') + 3000))
      && /totalTexte: r\.fiable \? null : trad\('Résultat non calculable'\)/.test(src),
      'la liste du journal et la fiche d’une vente disent « non calculable »');
    vrai(/\$\{!coutConnu\s*\n\s*\? trad\('non renseigné'\)/.test(src), 'et le prix de revient vendu aussi');
    vrai(/r\.fiable \? round2\(r\.montant\) : null,/.test(src),
      'l’export tableur laisse la cellule vide plutôt qu’un zéro');
    const ceder = src.slice(src.indexOf("async 'ceder-placement'(btn)"), src.indexOf("async 'editer-placement'(btn)"));
    vrai(/a\.realised === null/.test(ceder), 'le message de confirmation dit le produit, pas une plus-value');
    vrai(/const inconnu = gain === null;/.test(src), 'et l’aperçu de la fenêtre de cession aussi');
    vrai(I18N.en['Prix de revient non renseigné : aucune plus-value n’est calculée.'], 'traduit');
  });
});

/* ------------------------------------------------------------------
   La démonstration n'est jamais en retard
   ------------------------------------------------------------------
   Le serveur fabrique les mois ecoules depuis la graine, l'application les
   pose. Ces controles executent le calcul du serveur tel qu'il est ecrit dans
   `_worker.js`, puis regardent la demonstration a des dates reparties sur
   plusieurs annees : aucune ne doit reclamer quoi que ce soit au visiteur. */
suite('La démonstration n’est jamais en retard', () => {
  /* Le bloc du serveur, execute tel quel : il ne touche ni au reseau ni a
     l'environnement du worker. */
  const serveur = () => {
    const src = lireSource('_worker.js');
    const debut = src.indexOf('const DemoVivante = (() => {');
    const fin = src.indexOf('\n})();', debut);
    vrai(debut >= 0 && fin > debut, 'le calcul du serveur doit être trouvable');
    return new Function(src.slice(debut, fin + 6) + '\nreturn DemoVivante;')();
  };
  /* L'horloge figee le temps d'un controle, et rendue quoi qu'il arrive. */
  const sousLaDate = (iso, fn) => {
    const Vrai = Date;
    const t = new Vrai(iso + 'T10:00:00').getTime();
    class Fige extends Vrai {
      constructor(...a) { if (a.length) super(...a); else super(t); }
      static now() { return t; }
    }
    window.Date = Fige;
    try { return fn(); } finally { window.Date = Vrai; }
  };
  const poserGraine = () => {
    Store.state = structuredClone(SEED);
    Store.migrate();
    refreshAccounts();
  };
  const RETARDS = /à enregistrer|à saisir|Trou dans|à mettre à jour|à relever|jamais vérifié|jamais actualisés|Cours vieux/;
  const somme = v => Object.values(v).reduce((s, x) => s + num(x), 0);

  test('le calcul du serveur est déterministe, et le mois en cours avance avec le jour', () => {
    const D = serveur();
    const a = D.calculer('2026-09-27');
    eq(JSON.stringify(a), JSON.stringify(D.calculer('2026-09-27')), 'la même date rend le même mois à tout le monde');
    eq(a.mois.map(m => m.date).join(), '2026-09-01', 'le relevé de septembre');
    eq(a.depenses.map(d => d.month).join(), '2026-08-01,2026-09-01', 'août clos, septembre en cours');
    const debut = D.calculer('2026-09-03');
    eq(JSON.stringify(debut.mois), JSON.stringify(a.mois), 'le relevé du 1er ne bouge pas au fil du mois');
    vrai(somme(debut.depenses[1].v) < somme(a.depenses[1].v), 'les dépenses du mois en cours, elles, avancent');
    eq(Object.keys(D.calculer('2026-09-01').depenses[1].v).length, 0, 'le 1er, rien n’est encore dépensé');
    const an = D.calculer('2027-09-10');
    eq(an.mois.length, 13, 'un an plus tard, treize relevés');
    eq(an.depenses.length, 14, 'et quatorze mois de dépenses, le mois en cours compris');
  });

  test('chaque relevé porte le salaire, et l’épargne fait la différence au centime', () => {
    const D = serveur();
    const r = D.calculer('2027-03-15');
    let avant = { ...D.P.soldes }, du = D.P.dette.montant;
    r.mois.forEach((m, i) => {
      const dep = somme(r.depenses[i].v);
      const epargne = Math.round(D.P.revenus - D.P.charges - dep);
      eq(somme(m.soldes) - somme(avant), epargne,
        `${m.date} : les liquidités bougent de l’épargne du mois clos, ni plus ni moins`);
      vrai(/^Salary paid in/.test(m.commentaire), `${m.date} : le relevé dit le salaire`);
      const interets = du * D.P.pret.taux / 1200;
      vrai(Math.abs((du - m.dette) - (D.P.pret.mensualite - D.P.pret.assurance - interets)) <= 1,
        `${m.date} : le capital baisse de la mensualité moins l’assurance et les intérêts`);
      avant = m.soldes; du = m.dette;
    });
    eq(JSON.stringify(r.soldes), JSON.stringify(r.mois[r.mois.length - 1].soldes), 'les soldes du jour sont ceux du dernier relevé');
  });

  test('le capital restant dû de la graine suit son tableau, relevé après relevé', () => {
    if (sansGraineDeDemo('le tableau du crédit de la graine')) return;
    /* La regle du serveur, rejouee sur les releves de la graine : chaque mois,
       les interets du solde, l'assurance, et le reste de la mensualite qui
       rembourse le capital, arrondi a l'euro. Le releve de cloture du
       31 decembre reprend le solde du 1er : aucune echeance ne tombe entre. */
    const P = serveur().P;
    const remplis = SEED.monthly.filter(r => !rowIsEmpty(r));
    vrai(remplis.length > 30, 'la graine porte ses relevés');
    for (let k = 1; k < remplis.length; k++) {
      const a = remplis[k - 1], b = remplis[k], du = num(a.dettes);
      const attendu = b.date.slice(0, 7) === a.date.slice(0, 7) ? du
        : Math.max(0, Math.round(du - (P.pret.mensualite - P.pret.assurance - du * P.pret.taux / 1200)));
      eq(num(b.dettes), attendu, `${b.date} : le capital restant dû suit le tableau`);
    }
  });

  test('le serveur part exactement de la graine', () => {
    if (sansGraineDeDemo('le départ de la démonstration vivante')) return;
    const P = serveur().P;
    const remplis = SEED.monthly.filter(r => !rowIsEmpty(r));
    const dernier = remplis[remplis.length - 1];
    eq(P.depart, dernier.date, 'le départ est le dernier relevé de la graine');
    eq(P.dette.montant, num(dernier.dettes), 'avec son capital restant dû');
    eq(-num(SEED.now.pretAppart), P.dette.montant, 'le même que la photo actuelle');
    poserGraine();
    for (const [id, x] of Object.entries(P.soldes))
      pres(cashCompte(compteById(id)), x, `le solde de départ de ${id} est celui de la graine`);
    vrai((Store.state.etabs || []).some(e => (e.dettes || []).some(d => d.id === P.dette.id)),
      'le crédit porte l’identifiant que le serveur amortit');
    pres(somme(SEED.budget.income.map(x => x.amount)), P.revenus, 'les revenus sont ceux du budget');
    pres(round2(somme(SEED.budget.fixedCharges.map(x => x.amount))), P.charges, 'et les charges fixes aussi');
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      const r = SEED.budget.expenses.filter(x => x.month.slice(5, 7) === mm
        && x.month < P.depart && somme(x.v)).pop();
      eq(JSON.stringify(P.modeles[mm]), JSON.stringify(r && r.v),
        `le modèle de ${mm} est le dernier mois de la graine qui porte ce mois`);
    }
  });

  test('à n’importe quelle date, rien n’est en retard', () => {
    if (sansGraineDeDemo('la démonstration vivante')) return;
    const D = serveur();
    for (const jour of ['2026-09-27', '2026-10-01', '2026-12-31', '2027-01-01', '2027-02-28',
                        '2027-07-15', '2028-02-29', '2028-11-30']) {
      sousLaDate(jour, () => {
        poserGraine();
        const bilan = appliquerDemoVivante(D.calculer(jour));
        vrai(bilan && bilan.releves > 0, `${jour} : le relevé du mois est posé`);
        Store.state.quotes.lastRun = new Date().toISOString();
        const tard = healthChecks().map(x => x.title).filter(t => RETARDS.test(t));
        eq(tard.join(' · '), '', `${jour} : la cloche ne réclame rien`);
        eq(valeursARevoir().map(x => x.nom).join(', '), '', `${jour} : aucune valeur à revoir`);
        eq(currentMonthPending().missing, false, `${jour} : pas de relevé à enregistrer`);
        eq(depensesEnAttente().missing, false, `${jour} : pas de dépenses à saisir`);
        eq(trousReleves().length + trousDepenses().length, 0, `${jour} : aucun trou`);
        const ligne = Store.state.monthly.find(r => r.date === currentMonthKey());
        vrai(Math.abs(rowNet(ligne) - nowTotals().total) < 10,
          `${jour} : le relevé du mois est la photo du jour`);
      });
    }
  });

  test('ce que le visiteur a touché reste à lui', () => {
    if (sansGraineDeDemo('la démonstration vivante')) return;
    const D = serveur();
    sousLaDate('2026-10-10', () => { poserGraine(); appliquerDemoVivante(D.calculer('2026-10-10')); });
    const livret = compteById('livret').cash[0];
    livret.montant = 12345;
    const oct = Store.state.budget.expenses.find(r => r.month === '2026-10-01');
    oct.v = { ...oct.v, Groceries: 999 };
    const sept = JSON.stringify(Store.state.monthly.find(r => r.date === '2026-09-01'));
    sousLaDate('2026-12-03', () => appliquerDemoVivante(D.calculer('2026-12-03')));
    eq(num(compteById('livret').cash[0].montant), 12345, 'un solde corrigé à la main n’est pas réécrit');
    eq(num(Store.state.budget.expenses.find(r => r.month === '2026-10-01').v.Groceries), 999,
      'un mois de dépenses corrigé non plus');
    vrai(somme(Store.state.budget.expenses.find(r => r.month === '2026-11-01').v) > 0, 'novembre est posé');
    vrai(!rowIsEmpty(Store.state.monthly.find(r => r.date === '2026-12-01')), 'et le relevé de décembre');
    eq(JSON.stringify(Store.state.monthly.find(r => r.date === '2026-09-01')), sept,
      'un relevé déjà posé et intact redevient le même');
    vrai(num(compteById('courant').cash[0].montant) !== D.P.soldes.courant, 'le compte courant, intact, a suivi');
  });

  test('appliquer deux fois le même jour ne change rien', () => {
    if (sansGraineDeDemo('la démonstration vivante')) return;
    const D = serveur();
    sousLaDate('2027-04-18', () => {
      poserGraine();
      appliquerDemoVivante(D.calculer('2027-04-18'));
      const une = JSON.stringify(Store.state);
      appliquerDemoVivante(D.calculer('2027-04-18'));
      eq(JSON.stringify(Store.state), une, 'la mise à jour est idempotente');
    });
  });

  test('un état qui n’est pas né de la graine n’est jamais touché', () => {
    Fixture.poser();
    eq(estDemoVivante(), false, 'le jeu des tests n’a pas de numéro de graine');
    const src = lireSource('assets/app.js');
    vrai(/const demoEnCours = estDemoVivante\(\) \? demoAJour\(\) : null;/.test(src),
      'l’application ne demande les mois qu’à une copie de la graine');
    const store = lireSource('assets/store.js');
    vrai(/typeof SEED_VERSION !== 'undefined'/.test(store.slice(store.indexOf('function estDemoVivante'))),
      'et la garde lit la graine de la démonstration, absente du dépôt privé comme de la bêta');
  });

  test('la date du visiteur fait foi à un jour près, pas davantage', () => {
    const D = serveur();
    const midi = Date.parse('2026-10-01T10:00:00Z');
    eq(D.jourBorne('2026-10-02', midi), '2026-10-02', 'un fuseau en avance garde son jour');
    eq(D.jourBorne('2026-09-30', midi), '2026-09-30', 'un fuseau en retard aussi');
    eq(D.jourBorne('2031-01-01', midi), '2026-10-01', 'au-delà, c’est la date de Paris');
    eq(D.jourBorne('n’importe quoi', midi), '2026-10-01', 'et sans date lisible aussi');
    vrai(/if \(path === '\/api\/demo'\) \{\s*return json\(DemoVivante\.calculer\(DemoVivante\.jourBorne\(/.test(lireSource('_worker.js')),
      'la route sert le calcul pour la date bornée');
  });

  test('des cours en route ne sont pas des cours en retard', () => {
    Fixture.poser();
    Store.state.quotes.lastRun = null;
    const avant = typeof Quotes === 'undefined' ? undefined : Quotes;
    window.Quotes = { enCours: () => true };
    try {
      vrai(!healthChecks().some(x => /jamais actualisés/.test(x.title)), 'la cloche se tait pendant l’actualisation');
      vrai(!aRafraichir().some(x => x.genre === 'cours'), 'la liste d’avant relevé aussi');
      window.Quotes = { enCours: () => false };
      vrai(healthChecks().some(x => /jamais actualisés/.test(x.title)), 'et parle quand rien n’est en route');
    } finally { if (avant === undefined) delete window.Quotes; else window.Quotes = avant; }
    vrai(I18N.en['Les prix affichés ne viennent pas encore du marché'], 'la phrase est traduite');
  });
});

/* ------------------------------------------------------------------
   Marchés se range, et garde un journal des achats pour mémoire
   ------------------------------------------------------------------ */
suite('Marchés se range, et garde un journal des achats pour mémoire', () => {
  const app = () => lireSource('assets/app.js');
  const achat = (x = {}) => ({ date: '2026-03-12', name: 'MSCI World', qty: 10, price: 5.8,
                               currency: 'EUR', note: 'renfort', ...x });
  /* Ce qu'aucun geste du journal ne doit toucher, pris d'un bloc. */
  const empreinte = () => JSON.stringify({
    positions: Store.state.positions, comptes: Store.state.comptes, sales: Store.state.sales,
    monthly: Store.state.monthly, net: round2(patrimoine().net), pnl: portfolioPnl() });

  test('un ancien état reçoit un journal vide, et rien ne s’invente depuis le prix de revient', () => {
    Fixture.poser(s => { delete s.purchases; });
    Store.migrate();
    eq(JSON.stringify(Store.state.purchases), '[]', 'le journal part vide');
    Store.migrate();
    eq(JSON.stringify(Store.state.purchases), '[]', 'et le reste après une seconde migration');
    Fixture.poser(s => { s.purchases = 'n’importe quoi'; });
    Store.migrate();
    eq(JSON.stringify(Store.state.purchases), '[]', 'une valeur illisible redevient un journal vide');
    eq(JSON.stringify(SEED.purchases), '[]', 'la graine ne porte aucun achat');
  });

  test('un achat valide garde ses champs, et son montant se déduit', () => {
    Fixture.poser();
    const r = declarerAchat(achat());
    vrai(r.achat && !r.erreur, 'l’achat est noté');
    const a = Store.state.purchases[0];
    eq(Object.keys(a).sort().join(), 'currency,date,declaree,id,name,note,price,qty',
      'ni total, ni montant en euros, ni prix de revient stockés');
    eq(a.declaree, true, 'il est pour mémoire');
    pres(montantAchat(a), 58, 'le montant est la quantité fois le prix');
  });

  test('une saisie invalide est refusée sans rien toucher', () => {
    Fixture.poser();
    const demain = new Date(Date.now() + 2 * 864e5);
    const futur = isoLocal(demain);
    for (const [x, quoi] of [
      [{ date: futur }, 'une date future'], [{ date: '2026-02-30' }, 'un jour qui n’existe pas'],
      [{ date: 'hier' }, 'une date illisible'], [{ name: '   ' }, 'un nom vide'],
      [{ qty: 0 }, 'une quantité nulle'], [{ qty: -2 }, 'une quantité négative'],
      [{ price: Infinity }, 'un prix infini'], [{ price: '' }, 'un prix vide'],
      [{ currency: 'JPY' }, 'une devise inconnue'],
    ]) {
      const avant = JSON.stringify(Store.state.purchases);
      const r = declarerAchat(achat(x));
      vrai(!!r.erreur, `${quoi} est refusé`);
      eq(JSON.stringify(Store.state.purchases), avant, `${quoi} ne modifie rien`);
    }
  });

  test('modifier et retirer visent un achat par son identifiant, pas par son rang', () => {
    Fixture.poser();
    const vieux = declarerAchat(achat({ date: '2025-01-10', name: 'Ancien' })).achat;
    const recent = declarerAchat(achat({ date: '2026-05-02', name: 'Récent' })).achat;
    eq(achatsTries()[0].name, 'Récent', 'le journal se lit du plus récent au plus ancien');
    modifierAchat(vieux.id, achat({ date: '2025-01-10', name: 'Ancien corrigé', qty: 3 }));
    eq(Store.state.purchases.find(a => a.id === vieux.id).name, 'Ancien corrigé', 'le bon achat change');
    eq(Store.state.purchases.find(a => a.id === recent.id).name, 'Récent', 'l’autre reste');
    vrai(!!modifierAchat('inconnu', achat()).erreur, 'un identifiant inconnu ne modifie rien');
    retirerAchat(recent.id);
    eq(Store.state.purchases.map(a => a.name).join(), 'Ancien corrigé', 'le bon achat part, l’autre reste');
  });

  test('le journal ne touche ni aux titres, ni au prix de revient, ni aux espèces, ni aux ventes', () => {
    Fixture.poser();
    const avant = empreinte();
    const a = declarerAchat(achat()).achat;
    modifierAchat(a.id, achat({ qty: 99 }));
    retirerAchat(a.id);
    eq(empreinte(), avant, 'patrimoine, positions, cash, ventes et performance sont intacts');
  });

  test('un profil neuf suit la disposition par défaut sans rien écrire', () => {
    Fixture.poser();
    const d = dispositionMarches();
    eq(d.ordre.join(), CARTES_MARCHES.join(), 'l’ordre par défaut');
    eq(d.masquees.length, 0, 'rien de masqué');
    vrai(d.parDefaut, 'et c’est dit');
    Store.migrate(); Store.migrate();
    eq(Store.state.meta.marches, undefined, 'la migration n’écrit pas la clef');
  });

  test('un ordre importé malformé se lit quand même, complet', () => {
    Fixture.poser(s => { s.meta.marches = { ordre: ['ventes', 'inconnue', 'ventes', 'titres'],
                                            masquees: ['fantome', 'reperes', 'reperes'] }; });
    const d = dispositionMarches();
    eq(d.ordre.filter(id => id === 'ventes').length, 1, 'un doublon s’ignore');
    vrai(!d.ordre.includes('inconnue'), 'un identifiant inconnu aussi');
    eq(d.ordre.length, CARTES_MARCHES.length, 'aucune carte ne disparaît faute d’être nommée');
    eq(d.masquees.join(), 'reperes', 'les masquées inconnues ou en double s’ignorent');
    Fixture.poser(s => { s.meta.marches = { ordre: ['titres', 'retenir', 'reperes', 'ventes'] }; });
    eq(dispositionMarches().ordre.join(), CARTES_MARCHES.join(),
      'une carte nouvelle, absente d’un ordre ancien, reprend sa place par défaut');
    Fixture.poser(s => { s.meta.marches = { ordre: ['aujourdhui', 'retenir', 'titres', 'reperes', 'ventes', 'achats'] }; });
    eq(dispositionMarches().ordre.join(), 'retenir,titres,reperes,ventes,achats',
      'un ordre qui cite encore la carte du jour se lit sans elle, dans l’ordre choisi');
  });

  test('monter, descendre, masquer, et revenir exactement au défaut', () => {
    Fixture.poser();
    eq(deplacerCarteMarches('aujourdhui', -1), false, 'la première ne monte pas');
    eq(deplacerCarteMarches('achats', 1), false, 'la dernière ne descend pas');
    eq(deplacerCarteMarches('inconnue', 1), false, 'une carte inconnue ne bouge rien');
    eq(Store.state.meta.marches, undefined, 'aucun refus n’a rien écrit');
    vrai(deplacerCarteMarches('achats', -1), 'le journal des achats monte');
    eq(dispositionMarches().ordre.indexOf('achats'), CARTES_MARCHES.indexOf('achats') - 1, 'd’un cran');
    vrai(basculerCarteMarches('reperes'), 'les repères se masquent');
    eq(dispositionMarches().masquees.join(), 'reperes');
    basculerCarteMarches('reperes');
    deplacerCarteMarches('achats', 1);
    eq(Store.state.meta.marches, undefined, 'revenu au défaut, la clef s’efface');
    basculerCarteMarches('ventes');
    retablirDispositionMarches();
    eq(Store.state.meta.marches, undefined, 'et « Rétablir » l’efface aussi');
  });

  test('achats et disposition traversent un export puis un import', () => {
    Fixture.poser();
    declarerAchat(achat());
    basculerCarteMarches('reperes');
    const fichier = JSON.stringify(Store.state);
    Store.state = JSON.parse(fichier);
    Store.migrate();
    eq(Store.state.purchases.length, 1, 'l’achat revient');
    eq(dispositionMarches().masquees.join(), 'reperes', 'la disposition aussi');
  });

  test('l’Aperçu garde sa disposition, sur le même noyau', () => {
    Fixture.poser(s => { s.meta.apercu = { ordre: ['repartition', 'retenir', 'repartition', 'x'], masquees: ['retenir', 'reserve'] }; });
    const d = dispositionApercu();
    vrai(d.ordre.indexOf('repartition') < d.ordre.indexOf('retenir'), 'l’ordre enregistré est suivi');
    eq(d.ordre.length, CARTES_APERCU.length, 'complet');
    eq(d.masquees.join(), 'reserve', '« À retenir » ne se masque que par sa propre clef');
    Store.state.meta.retenirMasquee = true;
    vrai(dispositionApercu().masquees.includes('retenir'), 'qui compte toujours');
  });

  test('la page : le portefeuille et les outils restent, les cartes suivent la disposition', () => {
    const a = app();
    const vue = a.slice(a.indexOf('function viewPositions() {'), a.indexOf('\nfunction salesCard()'));
    vrai(/if \(enEditionMarches\(\)\) return editeurMarches\(\);/.test(vue), 'l’édition remplace la page');
    for (const id of CARTES_MARCHES) vrai(new RegExp(`\\n    ${id}: \\(\\) => `).test(vue), `la carte ${id} a sa fonction`);
    const ret = vue.slice(vue.indexOf('  return `' + String.fromCharCode(10) + '  ${barreEtatCours()}'));
    vrai(/\$\{barreEtatCours\(\)\}/.test(ret) && /\$\{carteTitresArchives\(\)\}/.test(ret)
      && /card repart ptf/.test(ret), 'barre des cours, archives et portefeuille restent fixes en tête');
    vrai(/\$\{composerMarches\(blocsMarches\)\}/.test(ret), 'le reste suit la disposition');
    vrai(!/realisee: \(\) =>|cumul: \(\) =>|id="perfVentes"|id="perfCumul"/.test(vue),
      'les graphiques « Réalisée » et « Cumul » sont partis');
    vrai(/salesCard\(\)/.test(vue.slice(vue.indexOf('    ventes: () => `'), vue.indexOf('\n  };', vue.indexOf('    ventes: () => `')))),
      'et le journal des ventes la sienne');
    vrai(/seulement: \(Store\.state\.sales \|\| \[\]\)\.length/.test(vue),
      'le journal des achats existe même sans position');
    vrai(/sousOngletActif\.positions !== 'cible'/.test(a.slice(a.indexOf('const enEditionMarches'))),
      'Cible ne se range pas');
    const comp = a.slice(a.indexOf('function composerMarches('), a.indexOf('const piedMarches'));
    vrai(/\+ \(id === 'titres' \? recherche : ''\)/.test(comp) && /visibles\.includes\('titres'\) \? '' : recherche/.test(comp),
      'la recherche d’un titre reste, sous les lignes ou en bas de page');
  });

  test('le montage survit aux cartes masquées, et les textes se traduisent', () => {
    const a = app();
    const mont = a.slice(a.indexOf('function mountPositions() {'), a.indexOf('function mountPositions() {') + 400);
    vrai(/if \(\$\('\.marches-edition'\)\) \{ reprendreFocusMarches\(\); return; \}/.test(mont),
      'en édition, le montage ne cherche aucun graphique');
    vrai(/const box = \$\('#reperes'\);\s*\n\s*if \(!box\) return;/.test(a), 'les repères masqués ne montent rien');
    vrai(/const pli = \$\('#pliVentes'\);\s*\n\s*if \(pli\)/.test(a), 'les ventes masquées non plus');
    vrai(/if \(key !== 'positions' \|\| sousOngletActif\.positions === 'cible'\) marchesEdition = false;/.test(a),
      'l’édition se referme en quittant Marchés');
    for (const k of ['Journal des achats', 'Noter un achat passé', 'Modifier cet achat', 'Retirer cet achat du journal ?',
                     'Achat retiré du journal', 'Aucun achat noté.', 'Quantité achetée', 'Prix d’achat unitaire',
                     'Pourquoi cet achat ?', 'Personnaliser Marchés', 'Afficher sur Marchés', 'Repères de marché',
                     'Pour mémoire : cet achat ne modifie ni les titres, ni le prix de revient, ni les espèces.'])
      vrai(!!I18N.en[k], `« ${k.slice(0, 40)} » a sa traduction`);
    const carte = a.slice(a.indexOf('function carteAchats()'), a.indexOf('function champsAchat('));
    vrai(!/investi|PRU/i.test(carte.replace(/\/\*[\s\S]*?\*\//g, '')), 'le montant d’un mémo ne se dit pas « investi »');
  });
});

/* ------------------------------------------------------------------
   Marchés : les journaux en bas, repliés, et une seule période
   ------------------------------------------------------------------ */
suite('Marchés : les journaux en bas, repliés, et une seule période', () => {
  const app = () => lireSource('assets/app.js');
  const fonction = (src, debut) => { const i = src.indexOf(debut); return src.slice(i, src.indexOf('\n}\n', i)); };

  test('par défaut, les deux journaux ferment la page', () => {
    Fixture.poser();
    const o = dispositionMarches().ordre;
    eq(o.slice(-2).join(), 'ventes,achats', 'le journal des ventes, puis celui des achats, ferment la page');
    vrai(!o.includes('realisee') && !o.includes('cumul'), 'et plus aucune carte de graphique');
  });

  test('une disposition ancienne se lit sans les cartes retirées, et rien ne s’écrit à l’ouverture', () => {
    /* Format 1 : un bloc « ventes » qui reunissait trois cartes. Il reste le
       journal des ventes, a sa place, masque s'il l'etait. */
    Fixture.poser(s => { s.meta.marches = { ordre: ['titres', 'aujourdhui', 'retenir', 'reperes', 'achats', 'ventes'],
                                            masquees: ['ventes', 'reperes'] }; });
    let d = dispositionMarches();
    eq(d.ordre.join(), 'titres,retenir,reperes,achats,ventes', 'l’ordre choisi est gardé, sans la carte du jour');
    eq([...d.masquees].sort().join(), 'reperes,ventes', 'les masquages aussi');
    eq(Store.state.meta.marches.version, undefined, 'la lecture n’écrit rien');
    /* Format 2 : les deux cartes retirees y figurent encore, masquees ou non. */
    Fixture.poser(s => { s.meta.marches = { version: 2,
      ordre: ['realisee', 'titres', 'cumul', 'aujourdhui', 'retenir', 'reperes', 'ventes', 'achats'],
      masquees: ['cumul', 'reperes'] }; });
    d = dispositionMarches();
    vrai(!d.ordre.includes('realisee') && !d.ordre.includes('cumul'), 'les cartes retirées s’ignorent');
    eq(d.ordre.join(), 'titres,retenir,reperes,ventes,achats', 'et le reste garde son ordre');
    eq(d.masquees.join(), 'reperes', 'un masquage de carte retirée s’oublie');
    eq(JSON.stringify(dispositionMarches()), JSON.stringify(d), 'la lecture est idempotente');
    basculerCarteMarches('reperes');
    vrai(!JSON.stringify(Store.state.meta.marches || {}).includes('realisee'), 'la première écriture les efface');
  });

  test('masquer le journal des ventes ne masque que lui', () => {
    Fixture.poser();
    basculerCarteMarches('ventes');
    eq(Store.state.meta.marches.version, 2);
    eq(dispositionMarches().masquees.join(), 'ventes', 'seul le journal est masqué');
  });

  test('les deux journaux arrivent repliés, se souviennent de la visite, et montrent tout une fois ouverts', () => {
    const a = app();
    vrai(/let journalDeroule = false;/.test(a) && /let achatsDeroules = false;/.test(a), 'repliés au chargement');
    vrai(/monterJournal\('ventes', pli, ouvert => \{ journalDeroule = ouvert; \}\)/.test(a)
      && /monterJournal\('achats', \$\('#pliAchats'\), ouvert => \{ achatsDeroules = ouvert; \}\)/.test(a),
      'l’ouverture survit aux rendus de la visite');
    vrai(!/journalDeroule|achatsDeroules/.test(lireSource('assets/store.js')), 'et ne s’enregistre nulle part');
    const achats = fonction(a, 'function carteAchats()');
    vrai(/<details class="data-view pli-journal" id="pliAchats"/.test(achats), 'les achats dans un pli');
    vrai(/<div class="journal-corps" data-journal="achats"><\/div>/.test(achats) && !/\.slice\(0/.test(achats),
      'tous, construits à l’ouverture, sans limite');
    const ventes = fonction(a, 'function salesCard()');
    vrai(/<details class="data-view pli-journal" id="pliVentes"/.test(ventes), 'les ventes dans un pli');
    vrai(/<div class="journal-corps" data-journal="ventes"><\/div>/.test(ventes) && !/\.slice\(0/.test(ventes),
      'toutes, construites à l’ouverture, sans « voir plus »');
    vrai(/trad\(st\.partiel \? 'Résultat net partiel' : 'Résultat net des ventes'\)/.test(ventes) && /fmtSigned\(st\.realised\)/.test(ventes),
      'le résumé fermé dit le nombre et le résultat');
  });

  test('une seule période des ventes, hors des cartes, avant la première qui reste visible', () => {
    const a = app();
    eq((a.match(/data-action-change="sales-range"/g) || []).length, 1, 'un seul sélecteur de plage');
    vrai(/\$\{selecteurAnneeTransactions\(\)\}/.test(fonction(a, 'function barrePeriodeTransactions()')),
      'dans sa propre barre, avec les années des deux journaux');
    vrai(!/rangeControl\(/.test(fonction(a, 'function salesCard()')), 'le journal ne le porte plus');
    const comp = fonction(a, 'function composerMarches(');
    vrai(/visibles\.find\(periodeAdmissible\)/.test(comp)
      && /id === premiere \? barrePeriodeTransactions\(\) : ''/.test(comp),
      'posée au-dessus de la première carte de ventes visible, même si le journal est masqué');
    vrai(/const CARTES_VENTES = \['ventes'\];/.test(a), 'le journal des ventes lit la période');
  });


  test('sans titre, les ventes passées et le journal des achats restent accessibles', () => {
    const vue = app().slice(app().indexOf('function viewPositions() {'), app().indexOf('\nfunction salesCard()'));
    vrai(/composerMarches\(blocsMarches, \{ seulement: \(Store\.state\.sales \|\| \[\]\)\.length\s*\n?\s*\? \['ventes', 'achats'\] : \['achats'\] \}\)/.test(vue),
      'la page vide montre les cartes de ventes et d’achats, dans l’ordre et les masquages choisis');
    vrai(vue.indexOf('const blocsMarches = {') < vue.indexOf('if (!Store.state.positions.length) {'),
      'les cartes sont définies avant la page vide, qui s’en sert');
  });

  test('les textes nouveaux se traduisent, et le résumé des achats ne somme pas deux devises', () => {
    for (const k of ['Période des transactions', 'Résultat réalisé', '{n} achat noté', '{n} achats notés',
                     'Dernier achat le {date}', 'Journal des ventes'])
      vrai(!!I18N.en[k], `« ${k.slice(0, 40)} » a sa traduction`);
    const achats = fonction(app(), 'function carteAchats()');
    vrai(!/reduce\(/.test(achats), 'aucun total entre EUR et USD');
    vrai(!/Le journal, plus haut/.test(app()), 'plus aucun texte ne dit le journal « plus haut »');
  });
});

/* ------------------------------------------------------------------
   Une période commune aux ventes et aux achats
   ------------------------------------------------------------------ */
suite('Une période commune aux ventes et aux achats', () => {
  const app = () => lireSource('assets/app.js');
  const fonction = (src, debut) => { const i = src.indexOf(debut); return src.slice(i, src.indexOf('\n}\n', i)); };
  const noter = (date, name = 'Titre') => declarerAchat({ date, name, qty: 1, price: 10, currency: 'EUR', note: '' });
  const ilYa = jours => isoLocal(new Date(Date.now() - jours * 864e5));

  test('les achats se filtrent par plage glissante, tous gardés et dans l’ordre', () => {
    Fixture.poser();
    noter(ilYa(10), 'Récent'); noter(ilYa(200), 'Milieu'); noter(ilYa(800), 'Ancien');
    eq(achatsSurPlage('1y').map(a => a.name).join(), 'Récent,Milieu', 'un an : les deux derniers, du plus récent au plus ancien');
    eq(achatsSurPlage('3y').map(a => a.name).join(), 'Récent,Milieu,Ancien', 'trois ans : tous');
    eq(achatsSurPlage('all').length, 3, 'tout : tous');
    eq(Store.state.purchases.length, 3, 'filtrer ne modifie rien');
  });

  test('par année civile, le 1er janvier et le 31 décembre sont compris', () => {
    Fixture.poser();
    noter('2025-01-01', 'Premier jour'); noter('2025-12-31', 'Dernier jour'); noter('2024-12-31', 'Veille');
    noter('2026-01-01', 'Lendemain');
    eq(achatsSurPlage('2025').map(a => a.name).join(), 'Dernier jour,Premier jour', 'les deux bornes de 2025, et rien d’autre');
  });

  test('le menu d’années réunit ventes et achats, sans doublon, du plus récent au plus ancien', () => {
    Fixture.poser(s => { s.sales = [{ date: '2025-03-01', realised: 10, invested: 100, gross: 110 },
                                   { date: '2023-06-01', realised: 5, invested: 50, gross: 55 }]; });
    noter('2024-05-05'); noter('2025-08-08');
    eq(anneesDesTransactions().join(','), '2025,2024,2023', 'les années des deux journaux');
    eq(anneesDesVentes().join(','), '2025,2023', 'celles des ventes seules sont inchangées');
    vrai(/\$\{annees\.length \? `/.test(fonction(app(), 'function rangeControl(')), 'le menu apparaît dès la première année');
  });

  test('la barre se pose au-dessus de la première carte concernée qui a des données', () => {
    const a = app();
    vrai(/const periodeAdmissible = id => \(CARTES_VENTES\.includes\(id\) && \(Store\.state\.sales \|\| \[\]\)\.length > 0\)\s*\n\s*\|\| \(id === 'achats' && \(Store\.state\.purchases \|\| \[\]\)\.length > 0\);/.test(a),
      'une carte de ventes s’il y a des ventes, les achats s’il y a des achats');
    const comp = fonction(a, 'function composerMarches(');
    vrai(/const premiere = visibles\.find\(journalPlein\) \|\| visibles\.find\(periodeAdmissible\);/.test(comp),
      'au-dessus du premier journal qui a des opérations, à défaut de la première carte qui a des données');
    eq((comp.match(/barrePeriodeTransactions\(\)/g) || []).length, 1, 'une seule barre');
  });

  test('sans transaction, ou toutes les cartes concernées masquées, pas de barre', () => {
    const comp = fonction(app(), 'function composerMarches(');
    vrai(/const visibles = d\.ordre\.filter\(id => !d\.masquees\.includes\(id\) && \(!seulement \|\| seulement\.includes\(id\)\)\);/.test(comp),
      'la recherche ne porte que sur les cartes visibles et retenues');
    Fixture.poser(s => { s.sales = []; s.purchases = []; });
    eq((Store.state.sales || []).length + (Store.state.purchases || []).length, 0,
      'sans vente ni achat, aucune carte n’est admissible, donc `find` ne rend rien');
  });

  test('le résumé dit « N achats sur M » et la date du dernier achat de la période', () => {
    const c = fonction(app(), 'function carteAchats()');
    vrai(/const tous = achatsTries\(\);\s*\n\s*const achats = achatsSurPlage\(periodeTransactions\(\)\);/.test(c), 'tous pour savoir, la période pour montrer');
    vrai(/achats\.length < tous\.length/.test(c) && /trad\('\{n\} achats sur \{t\}'\)/.test(c) && /trad\('\{n\} achat sur \{t\}'\)/.test(c),
      'le compte filtré dit sur combien');
    vrai(/fmtDate\(achats\[0\]\.date\)/.test(c), 'la date est celle du premier achat retenu');
    vrai(!/reduce\(/.test(c), 'toujours aucun total entre devises');
  });

  test('une période sans achat n’est pas un journal vide', () => {
    const c = fonction(app(), 'function carteAchats()');
    vrai(/: tous\.length \? `\s*\n\s*<p class="hint" style="margin:0">\$\{trad\('Aucun achat sur cette période\.'\)\}<\/p>` : ''/.test(c),
      'la période vide a sa phrase, distincte de « Aucun achat noté. »');
    vrai(/data-action="achat-noter"/.test(c), 'et le bouton reste là');
    vrai(/if \(!tous\.length\) return `\s*\n\s*<p class="hint journal-vide" data-anchor="achats">/.test(c)
      && /class="lien-nu" data-action="achat-noter"/.test(c),
      'sans aucun achat, une ligne hors carte, qui porte le geste');
    for (const k of ['Période des transactions', '{n} achat sur {t}', '{n} achats sur {t}', 'Aucun achat sur cette période.'])
      vrai(!!I18N.en[k], `« ${k} » a sa traduction`);
  });

  test('les ventes lisent toujours la même plage, et leurs résultats ne bougent pas', () => {
    Fixture.poser(s => { s.sales = [{ date: ilYa(20), realised: 30, invested: 100, gross: 130, qty: 1, buyPrice: 100 },
                                   { date: ilYa(600), realised: -5, invested: 50, gross: 45, qty: 1, buyPrice: 50 }]; });
    noter(ilYa(5));
    pres(salesStats('1y').realised, 30, 'un achat noté ne change rien aux ventes');
    eq(salesStats('all').count, 2);
    const a = app();
    vrai(/const st = salesStats\(periodeTransactions\(\)\);/.test(fonction(a, 'function salesCard()')), 'le journal des ventes lit la plage commune');
    eq((a.match(/data-action-change="sales-range"/g) || []).length, 1, 'toujours un seul sélecteur');
  });
});

/* ------------------------------------------------------------------
   Des journaux longs : tout, par mois, et un nom pour retrouver
   ------------------------------------------------------------------ */
suite('Des journaux longs : tout, par mois, et un nom pour retrouver', () => {
  const app = () => lireSource('assets/app.js');
  const fonction = (src, debut) => { const i = src.indexOf(debut); return src.slice(i, src.indexOf('\n}\n', i)); };
  const jour = (a, m, d) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  /* Des ventes fictives, reparties sur dix mois de 2025. */
  const ventes = n => Array.from({ length: n }, (_, i) => {
    const realised = i % 5 ? 2 + (i % 3) : -(1 + (i % 4));
    return { id: 's' + i, date: jour(2025, 1 + (i % 10), 1 + (i % 27)), name: i % 7 ? 'Titre ' + (i % 13) : 'Société Élan',
             qty: 1, price: 8 + realised, buyPrice: 8, currency: 'EUR', gross: 8 + realised, invested: 8, realised,
             account: '', cashAccount: '' };
  });

  test('200 ventes ouvertes : 200 lignes, par mois, et des sous-totaux qui refont le résultat', () => {
    Fixture.poser(s => { s.sales = ventes(200); });
    const j = journalVentes({ range: '2025', tri: 'date' });
    eq(j.lignes.length, 200, 'deux cents lignes, sans limite');
    eq(j.total, 200);
    eq(j.groupes.reduce((n, g) => n + g.lignes.length, 0), 200, 'chaque vente est dans un mois, une fois');
    eq(j.groupes.map(g => g.mois).join(), ['10', '09', '08', '07', '06', '05', '04', '03', '02', '01']
      .map(m => '2025-' + m).join(), 'les mois du plus récent au plus ancien');
    vrai(j.lignes.every((v, i) => !i || String(j.lignes[i - 1].date) >= String(v.date)), 'les lignes aussi');
    pres(round2(j.groupes.reduce((s, g) => s + g.sousTotal, 0)), round2(salesStats('2025').realised),
      'la somme des sous-totaux est le résultat de la période');
    for (const g of j.groupes)
      vrai(g.lignes.every(v => v.date.slice(0, 7) === g.mois), `${g.mois} ne porte que ses ventes`);
    vrai(j.lignes.every(v => Store.state.sales[j.rang.get(v)] === v), 'chaque ligne garde sa place pour la fiche');
  });

  test('par montant, un classement global sans mois', () => {
    Fixture.poser(s => { s.sales = ventes(60); });
    const j = journalVentes({ range: 'all', tri: 'montant' });
    eq(j.groupes, null, 'grouper détruirait le classement');
    vrai(j.lignes.every((v, i) => !i || num(j.lignes[i - 1].realised) >= num(v.realised)), 'du plus gros gain à la pire perte');
  });

  test('la recherche ignore casse et accents, dit zéro, et se vide', () => {
    Fixture.poser(s => { s.sales = ventes(200); });
    const tous = journalVentes({ range: '2025' });
    const q = journalVentes({ range: '2025', requete: '  societe elan ' });
    vrai(q.lignes.length > 0 && q.lignes.every(v => v.name === 'Société Élan'), 'sans casse ni accents');
    eq(q.total, tous.total, 'le total reste celui de la période : « n sur t »');
    pres(round2(q.groupes.reduce((s, g) => s + g.sousTotal, 0)), round2(q.lignes.reduce((s, v) => s + num(v.realised), 0)),
      'les sous-totaux ne portent que sur les correspondances');
    eq(journalVentes({ range: '2025', requete: 'introuvable' }).lignes.length, 0, 'aucun résultat');
    eq(journalVentes({ range: '2025', requete: '' }).lignes.length, 200, 'une recherche vide rend tout');
  });

  test('1 000 achats ouverts, en euros et en dollars, sans total additionné', () => {
    Fixture.poser(s => {
      s.purchases = Array.from({ length: 1000 }, (_, i) => ({ id: 'a' + i, date: jour(2024 + (i % 2), 1 + (i % 12), 1 + (i % 28)),
        name: 'Ligne ' + (i % 40), qty: 1 + (i % 3), price: 5 + (i % 7), currency: i % 2 ? 'USD' : 'EUR', note: '', declaree: true }));
    });
    const j = journalAchats({ range: 'all' });
    eq(j.lignes.length, 1000, 'mille lignes, sans limite');
    eq(j.groupes.reduce((n, g) => n + g.lignes.length, 0), 1000, 'chaque achat dans son mois');
    vrai(j.groupes.every(g => !('sousTotal' in g)), 'aucun sous-total entre devises');
    eq(journalAchats({ range: '2024' }).lignes.length, 500, 'la période commune s’applique');
    eq(journalAchats({ range: 'all', requete: 'LIGNE 7' }).lignes.length, 25, 'la recherche aussi, sur le nom entier : « Ligne 17 » ne contient pas « ligne 7 »');
  });

  test('un journal replié ne construit aucune ligne, et un journal ouvert se garde entre deux rendus', () => {
    const a = app();
    for (const f of ['function salesCard()', 'function carteAchats()'])
      vrai(!/ligneListe\(|lignesJournalVentes\(|ligneJournalAchat/.test(fonction(a, f)), `${f} ne fabrique plus ses lignes`);
    const remplir = fonction(a, 'function remplirJournal(');
    vrai(/if \(c && c\.signature === signature\) \{\s*\n\s*if \(c\.noeud\.parentNode !== corps\) corps\.replaceChildren\(c\.noeud\);/.test(remplir),
      'même contenu : le même nœud se rattache, rien ne se reconstruit');
    const sig = fonction(a, 'function signatureJournal(');
    for (const m of ['periodeTransactions()', 'triVentes', 'JOURNAUX[cle].requete', 'currentLang()', 'masqueActif()', 'j.rang.get(v)'])
      vrai(sig.includes(m), `la signature change avec ${m}`);
    const monter = fonction(a, 'function monterJournal(');
    vrai(/pli\.ontoggle = \(\) => \{ noterOuverture\(pli\.open\); if \(pli\.open\) remplirJournal\(cle\); \}/.test(monter),
      'les lignes se construisent à l’ouverture');
    vrai(/champ\.oninput = \(\) => \{ JOURNAUX\[cle\]\.requete = champ\.value; JOURNAUX\.focus = cle; remplirJournal\(cle\); \}/.test(monter),
      'la frappe ne reconstruit que le journal');
    vrai(!/JOURNAUX\./.test(lireSource('assets/store.js')) && !/requete/.test(fonction(a, 'function ecrireDispositionMarches(') + JSON.stringify(Store.state.meta || {})),
      'et la recherche ne s’enregistre pas');
    const regles = (lireSource('assets/styles.css').match(/^\.(journal-|pli-journal)[^{]*\{[^}]*\}/gm) || []).join('\n');
    vrai(regles.length > 200 && !/overflow|max-height/.test(regles), 'aucun défilement intérieur dans les journaux');
  });

  test('le menu d’années se voit, montre l’année choisie, et ce choix tient', () => {
    const a = app();
    const rc = fonction(a, 'function rangeControl(');
    vrai(/class="annee\$\{surAnnee \? ' on' : ''\}"/.test(rc), 'il s’allume sur l’année active');
    vrai(/<option value="" disabled\$\{surAnnee \? '' : ' selected'\}>\$\{trad\('Choisir une année'\)\}<\/option>/.test(rc),
      'son invite ne se choisit pas');
    vrai(/if \(!sel \|\| sel\.dataset\.actionChange === 'sales-range'\) return;/.test(a),
      'le choix d’une année n’est traité qu’une fois : le second passage le ramenait à un an');
    vrai(/const v = String\(btn\.dataset\.range \?\? btn\.dataset\.year \?\? btn\.value \?\? ''\);/.test(a), 'et l’action lit l’année, d’où qu’elle vienne');
    vrai(/\.plage select\.annee \{\s*\n\s*appearance: none;/.test(lireSource('assets/styles.css')), 'avec un chevron dessiné');
  });

  test('la période se lit dans sa barre, pas dans les résumés, et la barre se pose au-dessus des journaux', () => {
    const a = app();
    for (const f of ['function salesCard()', 'function carteAchats()'])
      vrai(!/Période : \{p\}|pli-periode/.test(fonction(a, f)), `${f} ne répète pas la période de la barre`);
    vrai(/const premiere = visibles\.find\(journalPlein\) \|\| visibles\.find\(periodeAdmissible\);/.test(fonction(a, 'function composerMarches(')),
      'au-dessus du premier journal qui a des opérations');
    for (const k of ['Choisir une année', 'Filtrer par nom', 'Effacer le filtre', 'Recherche : {n} sur {t}',
                     'Aucun résultat pour ce nom.', 'Sous-total du mois', 'Sans date'])
      vrai(!!I18N.en[k], `« ${k} » a sa traduction`);
  });

  test('le nom du mois se détache des lignes du journal', () => {
    /* Le mois separe les blocs d'un long journal : il porte l'encre
       d'accent, qui est deja une encre de texte, et se distingue ainsi des
       noms des titres qu'il groupe. */
    vrai(/\.journal-mois-nom \{ margin: 0; font: inherit; color: var\(--accent\); \}/.test(lireSource('assets/styles.css')),
      'le mois s’écrit dans l’accent');
  });
});

/* ------------------------------------------------------------------
   Un seul sélecteur d'année pour les transactions
   ------------------------------------------------------------------ */
suite('Un seul sélecteur d’année pour les transactions', () => {
  const app = () => lireSource('assets/app.js');
  const fonction = (src, debut) => { const i = src.indexOf(debut); return src.slice(i, src.indexOf('\n}\n', i)); };
  const poser = (ventes, achats) => Fixture.poser(s => {
    s.sales = ventes.map((d, i) => ({ id: 'v' + i, date: d, name: 'V', realised: 1, invested: 1, gross: 2 }));
    s.purchases = achats.map((d, i) => ({ id: 'a' + i, date: d, name: 'A', qty: 1, price: 1, currency: 'EUR', note: '', declaree: true }));
  });

  test('l’année par défaut : la courante si elle a des opérations, sinon la dernière, sinon tout', () => {
    poser(['2026-03-01', '2024-05-01'], ['2025-02-02']);
    eq(anneeParDefautTransactions('2026-09-28'), '2026', 'l’année en cours porte une vente');
    eq(anneeParDefautTransactions('2027-01-01'), '2026', 'le 1er janvier, une année vide cède la place à la dernière pleine');
    poser([], ['2023-06-06']);
    eq(anneeParDefautTransactions('2026-09-28'), '2023', 'un achat suffit à faire une année');
    poser([], []);
    eq(anneeParDefautTransactions('2026-09-28'), 'all', 'sans aucune opération, tout l’historique');
  });

  test('un choix devenu invalide se lit au défaut sans être effacé', () => {
    const a = app();
    const p = fonction(a, 'function periodeTransactions()');
    vrai(/if \(r === 'all'\) return 'all';/.test(p)
      && /estAnnee\(r\) && anneesDesTransactions\(\)\.map\(String\)\.includes\(String\(r\)\)\) return String\(r\);/.test(p)
      && /return anneeParDefautTransactions\(\);/.test(p), 'une année sans opération retombe sur le défaut');
    vrai(!/salesRange =/.test(p), 'et la lecture n’écrit rien : le choix revient s’il redevient valide');
    vrai(/let salesRange = null;/.test(a), 'rien de choisi au départ');
  });

  test('le menu : les années pleines, décroissantes, puis toutes les années', () => {
    poser(['2026-03-01', '2024-05-01'], ['2025-02-02', '2026-01-01']);
    eq(anneesDesTransactions().map(String).join(), '2026,2025,2024', 'aucune année vide, aucun doublon');
    const s = fonction(app(), 'function selecteurAnneeTransactions()');
    vrai(/\$\{annees\.map\(y => `<option value="\$\{esc\(y\)\}"/.test(s), 'une option par année pleine');
    vrai(s.indexOf("<option value=\"all\"") > s.indexOf('annees.map('), '« Toutes les années » en dernier');
    vrai(/class="annee on"/.test(s) && /data-action-change="sales-range"/.test(s), 'toujours allumé, sur la seule action de la période');
    vrai(!/rangeControl\(|YTD|3y|5y/.test(s), 'plus aucune durée glissante');
    eq(I18N.en['Toutes les années'], 'All years');
  });

  test('l’action n’accepte qu’une année ou tout', () => {
    const act = app().slice(app().indexOf("'sales-range'(btn) {"), app().indexOf("'sales-range'(btn) {") + 400);
    vrai(/if \(v !== 'all' && !estAnnee\(v\)\) return;/.test(act), 'une durée glissante s’ignore');
  });

  test('tous les lecteurs passent par la période effective', () => {
    const nu = app().replace(/\/\*[\s\S]*?\*\//g, '');
    const restes = (nu.match(/salesRange/g) || []).length;
    eq(restes, 3, 'salesRange ne se lit plus que dans sa déclaration, sa lecture et l’action');
    const sig = fonction(app(), 'function signatureJournal(');
    vrai(/periodeTransactions\(\)/.test(sig), 'la signature des journaux suit la période effective');
  });

  test('les autres plages gardent leurs boutons', () => {
    const a = app();
    vrai(/rangeControl\('evo-range', evoRange\)/.test(a) && /rangeControl\('pace-range', paceRange\)/.test(a),
      'l’évolution du patrimoine et le rythme gardent leurs durées');
    /* Compare au libelle que la table porte, pas a une traduction faite maintenant :
       la table se traduit au chargement, et l'integration continue passe en
       anglais apres. Deux traductions faites a deux moments ne se comparent pas. */
    eq(rangeLabel('all'), HISTORY_RANGES.find(r => r.id === 'all').label, '« Tout » reste le mot des autres plages');
    vrai(rangeLabel('all') !== trad('Toutes les années'), 'et « Toutes les années » n’appartient qu’au menu des transactions');
  });
});

/* ------------------------------------------------------------------
   Les règles vivent dans AGENTS.md, et CLAUDE.md l'importe
   ------------------------------------------------------------------ */
suite('Les règles vivent dans AGENTS.md, et CLAUDE.md l’importe', () => {
  const agents = () => lireSource('AGENTS.md');
  test('un index court, lu par les deux agents', () => {
    const a = agents(), claude = lireSource('CLAUDE.md');
    vrai(a !== null, 'AGENTS.md est lisible');
    const octets = new TextEncoder().encode(a).length;
    vrai(octets < 10240, `l’index tient sous 10 Kio : ${octets} octets, le détail vit dans regles/`);
    vrai(claude !== null && /^@AGENTS\.md$/m.test(claude) && claude.length < 800, 'CLAUDE.md l’importe sans le recopier');
    vrai(a.trimEnd().slice(-300).includes('FIN-DES-REGLES'), 'le témoin de lecture est tout à la fin');
    vrai(!/project_doc_max_bytes/.test(a), 'plus de prérequis de taille : l’index tient dans ce que Codex lit par défaut');
  });
  test('chaque geste obligatoire nomme son fichier, et chaque lien mène quelque part', () => {
    const a = agents();
    const obligatoire = a.slice(a.indexOf('## Obligatoire, selon le geste'), a.indexOf('\n## ', a.indexOf('## Obligatoire') + 5));
    /* Chaque geste sur SA ligne : echanger deux liens garderait les liens
       presents, et enverrait l'agent lire le mauvais fichier. */
    for (const [geste, f] of [['tests', 'regles/tests.md'], ['pousser', 'regles/publier.md'],
                              ['commentaire', 'regles/donnees-personnelles.md'], ['interface', 'regles/interface.md'],
                              ['calcul', 'regles/principes.md']]) {
      const ligne = obligatoire.split('\n').find(l => l.includes(`[${f}](${f})`));
      vrai(ligne && ligne.split('|')[1].includes(geste), `« ${geste} » mène à ${f}`);
    }
    for (const [, f] of a.matchAll(/\]\((regles\/[^)]+)\)/g))
      vrai(lireSource(f) !== null, `${f} existe`);
  });
  test('aucun fichier de regles/ n’est orphelin', () => {
    const liste = lireSource('regles/');
    vrai(liste !== null, 'le serveur liste regles/');
    const fichiers = [...liste.matchAll(/href="([^"?#/]+\.md)"/g)].map(m => m[1]);
    vrai(fichiers.length >= 9, 'les fichiers de règles sont là');
    for (const f of fichiers) vrai(agents().includes(`(regles/${f})`), `regles/${f} est lié depuis l’index`);
  });
});

/* ------------------------------------------------------------------
   Le journal des ventes porte le résultat net, et dit ses limites
   ------------------------------------------------------------------ */
suite('Le journal des ventes porte le résultat net, et dit ses limites', () => {
  const app = () => lireSource('assets/app.js');
  const fonction = (src, debut) => { const i = src.indexOf(debut); return src.slice(i, src.indexOf('\n}\n', i)); };
  /* Le produit suit le cout et le resultat, sauf quand un test le pose : c'est
     la coherence que `resultatVente` exige d'une vente effective. */
  const vente = (x = {}) => {
    const v = { id: 'v' + Math.random().toString(36).slice(2), date: '2025-06-10', name: 'Titre',
                qty: 2, price: 60, buyPrice: 50, currency: 'EUR', invested: 100, realised: 20, ...x };
    if (!('gross' in x)) v.gross = num(v.invested) + (Number(v.realised) || 0);
    return v;
  };

  test('une vente est fiable, ou dit pourquoi elle ne l’est pas', () => {
    eq(resultatVente(vente()).fiable, true, 'titres avec prix de revient');
    eq(resultatVente(vente({ realised: -15 })).montant, -15, 'une perte est un résultat');
    const sansPru = resultatVente(vente({ buyPrice: 0, invested: 0, realised: 120 }));
    eq(sansPru.fiable, false, 'titres sans prix de revient : le produit n’est pas une plus-value');
    eq(sansPru.montant, null);
    eq(resultatVente(vente({ buyPrice: undefined, qty: undefined })).fiable, false, 'même sans quantité enregistrée');
    eq(resultatVente(vente({ realised: null })).fiable, false, 'un résultat absent');
    eq(resultatVente(vente({ realised: 'abc' })).fiable, false, 'un résultat qui n’est pas un nombre');
    eq(resultatVente({ declaree: true, realised: 300, invested: 2900, gross: 3200 }).fiable, true, 'une vente déclarée');
    eq(resultatVente({ cession: 'vente', realised: 3300, invested: 0, gross: 3300 }).fiable, true,
      'une cession au coût déclaré nul');
    eq(resultatVente({ cession: 'vente', realised: null, invested: null, gross: 3300 }).raison, 'prixDeRevient',
      'une cession au coût inconnu manque de prix de revient');
    eq(resultatVente(vente({ realised: 500, gross: 120 })).raison, 'incoherent',
      'un résultat qui contredit produit et coût n’est pas un chiffre à additionner');
    eq(resultatVente(vente({ realised: 20.004, gross: 120 })).fiable, true, 'l’arrondi, lui, est toléré');
    eq(resultatVente(vente({ gross: 1000000, invested: 999999.5, realised: 1.5 })).raison, 'incoherent',
      'un euro d’écart sur un gros produit n’est pas un arrondi');
    eq(resultatVente(vente({ gross: 1000000, invested: 999999.5, realised: 0.5 })).fiable, true,
      'le petit gain juste, lui, passe');
    eq(resultatVente(vente({ gross: null })).raison, 'historique', 'un produit absent : historique incomplet');
    eq(resultatVente(vente({ realised: null })).raison, 'resultat', 'un résultat absent se dit comme tel');
    eq(resultatVente(vente({ buyPrice: 0, invested: 0, realised: 120 })).raison, 'prixDeRevient');
  });

  test('le total net compte les pertes, et seulement les ventes fiables', () => {
    const st = statsDesVentes([vente({ realised: 50 }), vente({ realised: -20 }),
                               vente({ buyPrice: 0, invested: 0, realised: 120 })]);
    pres(st.realised, 30, 'gains moins pertes, la vente sans prix de revient exclue');
    eq(st.fiables, 2); eq(st.nonFiables, 1); eq(st.partiel, true, 'le total le sait');
    eq(st.wins, 1, 'une seule vente gagnante fiable');
    pres(st.gross, 350, 'le produit, lui, compte toutes les ventes');
    pres(st.grossFiables, 230, 'et celui des seules ventes fiables se tient à part');
    const vide = statsDesVentes([vente({ buyPrice: 0, invested: 0, realised: 120 })]);
    eq(vide.fiables, 0, 'que des ventes non calculables');
    pres(vide.realised, 0);
    eq(vide.pct, null, 'aucun pourcentage sur une base absente');
  });

  test('le journal trie, groupe et sous-totalise sur la même règle', () => {
    Fixture.poser(s => { s.sales = [
      vente({ id: 'a', date: '2025-06-01', realised: 50 }), vente({ id: 'b', date: '2025-06-02', realised: -20 }),
      vente({ id: 'c', date: '2025-06-03', buyPrice: 0, invested: 0, realised: 999 }),
      vente({ id: 'd', date: '2025-05-01', buyPrice: 0, invested: 0, realised: 500 })]; });
    const m = journalVentes({ range: '2025', tri: 'montant' });
    eq(m.lignes.map(v => v.id).join(), 'a,b,c,d', 'par montant : gain, perte, puis les non calculables en fin');
    const d = journalVentes({ range: '2025', tri: 'date' });
    const juin = d.groupes.find(g => g.mois === '2025-06'), mai = d.groupes.find(g => g.mois === '2025-05');
    pres(juin.sousTotal, 30, 'juin : 50 − 20, sans les 999 inventés');
    eq(juin.partiel, true, 'et le mois se dit partiel');
    eq(mai.sousTotal, null, 'mai n’a aucun résultat calculable');
    eq(journalVentes({ range: '2025', requete: 'titre' }).lignes.length, 4, 'le filtre garde les non calculables');
  });

  test('une vente de titres sans prix de revient n’invente plus de plus-value à la saisie', () => {
    Fixture.poser(s => { s.positions[0].buyPrice = 0; });
    const p = Store.state.positions[0];
    const ap = salePreview(p, 1, 100, 1);
    eq(ap.realised, null, 'le résultat n’existe pas');
    eq(ap.pct, null, 'ni son pourcentage');
    const avant = Store.state.sales.length;
    sellPosition({ index: 0, qty: 1, price: 100, fxSell: 1, cashAccount: '', date: '2025-06-01' });
    eq(Store.state.sales.length, avant + 1, 'la vente est bien enregistrée');
    eq(Store.state.sales[0].realised, null, 'sans résultat inventé');
    eq(resultatVente(Store.state.sales[0]).fiable, false);
    Fixture.poser();
    const q = salePreview(Store.state.positions[0], 1, 100, 1);
    vrai(q.realised != null && q.pct != null, 'avec un prix de revient, le résultat se calcule toujours');
  });

  test('le résumé dit le résultat net, partiel ou impossible, avant frais et fiscalité', () => {
    const c = fonction(app(), 'function salesCard()');
    vrai(/!st\.fiables \? trad\('Aucun résultat calculable'\)/.test(c), 'sans vente fiable, aucun total');
    vrai(/trad\(st\.partiel \? 'Résultat net partiel' : 'Résultat net des ventes'\)/.test(c), 'partiel, dit comme tel');
    vrai(/trad\('avant frais et fiscalité'\)/.test(c), 'la limite des frais se lit sans ouvrir');
    vrai(/trad\('\{n\} ventes exclues'\)/.test(c) && /trad\('1 vente exclue'\)/.test(c), 'et combien de ventes il écarte');
    vrai(!/plus-values encaissées/i.test(c), 'jamais « plus-values encaissées »');
  });

  test('la fiche, l’export et la signature suivent la même règle', () => {
    const a = app();
    const fiche = a.slice(a.indexOf('  vente: (i) => {'), a.indexOf('  vente: (i) => {') + 3500);
    vrai(/const r = resultatVente\(v\);/.test(fiche) && /const coutConnu = v\.invested != null && \(r\.fiable \|\| v\.declaree \|\| \(v\.cession && r\.raison !== 'prixDeRevient'\)\);/.test(fiche),
      'la fiche ne montre pas un coût jamais saisi');
    vrai(/<dt>\$\{trad\('Prix de revient unitaire'\)\}<\/dt><dd>\$\{!coutConnu\s*\n\s*\? trad\('non renseigné'\)/.test(fiche),
      'ni un prix de revient unitaire à zéro');
    vrai(/`\$\{motifVente\(r\)\}\. \$\{trad\('Pour le corriger, annule la vente puis ressaisis-la\.'\)\}`/.test(fiche),
      'et dit ce qui manque, puis comment corriger');
    const exp = fonction(a, 'function sheetSales()');
    vrai(/resultatVente\(v\)/.test(exp) && /st\.partiel \? 'Total des ventes fiables' : 'Total'/.test(exp)
      && /!st\.fiables \? 'Aucune vente fiable'/.test(exp), 'l’export laisse vide et dit son périmètre');
    vrai(/st\.fiables \? round2\(st\.grossFiables\) : null/.test(exp), 'l’encaissé du total porte les mêmes ventes que le résultat');
    vrai(/coutConnu && estNombre\(v\.buyPrice\) \? round2\(num\(v\.buyPrice\)\) : null/.test(exp), 'et aucun prix de revient à zéro');
    vrai(/v\.buyPrice, v\.cession\]/.test(fonction(a, 'function signatureJournal(')), 'le cache se renouvelle sur ces champs');
    for (const k of ['non calculable', 'Résultat net des ventes', 'Résultat net partiel', 'Aucun résultat calculable',
                     '{n} ventes exclues', '1 vente exclue', 'avant frais et fiscalité', 'Sous-total partiel',
                     'Résultat non calculable', 'Résultat non calculable : prix de revient non renseigné',
                     'Pour le corriger, annule la vente puis ressaisis-la.', 'Vente enregistrée',
                     'résultat non enregistré', 'montants incomplets', 'montants incohérents'])
      vrai(!!I18N.en[k], `« ${k.slice(0, 40)} » a sa traduction`);
  });

  test('les graphiques et ce qui ne servait qu’à eux sont partis, les ventes restent', () => {
    const tout = app() + lireSource('assets/store.js');
    for (const mort of ['perfVentes', 'perfCumul', 'salesCumulative', 'ventesParPeriode', 'ventesSeNomment',
                        'pasDesVentes', 'perfRealisee', 'perfTotale'])
      vrai(!new RegExp(mort).test(tout), `${mort} n’existe plus`);
    Fixture.poser(s => { s.sales = [vente({ buyPrice: 0, invested: 0, realised: 120 })]; });
    Store.migrate();
    eq(Store.state.sales.length, 1, 'aucune vente n’est retirée ni réécrite');
    eq(Store.state.sales[0].realised, 120, 'sa valeur brute est gardée telle quelle');
  });
});

/* ------------------------------------------------------------------
   Le resume d'un journal garde son resultat a droite
   ------------------------------------------------------------------ */
suite('Le résumé d’un journal garde son résultat à droite', () => {
  test('trois colonnes : le chevron, le compte, puis le résultat qui se replie chez lui', () => {
    const css = lireSource('assets/styles.css');
    vrai(/\.pli-journal > summary \{\s*\n\s*display: grid; grid-template-columns: auto max-content minmax\(0, 1fr\);/.test(css),
      'le résultat ne passe plus sous le compte');
    vrai(/\.pli-journal \.pli-compte \{ font-weight: 600; white-space: nowrap; \}/.test(css), 'le compte tient sur sa ligne');
    vrai(/\.pli-journal \.pli-detail \{ text-align: right; \}/.test(css), 'le résultat reste aligné à droite');
    vrai(!/pli-periode/.test(css + lireSource('assets/app.js')), 'la ligne de période a disparu des résumés');
  });
});

/* ------------------------------------------------------------------
   Carte du jour : une ligne retenue qui n'a pas cote n'est pas "aucune ligne"
   ------------------------------------------------------------------ */
suite('La carte du jour ne dit pas « Aucune ligne » à une ligne hors séance', () => {
  test('le bouton compte les lignes du jour', () => {
    const src = lireSource('assets/app.js');
    const f = src.slice(src.indexOf('function sectionJour()'), src.indexOf('\n}\n', src.indexOf('function sectionJour()')));
    vrai(/\(j\.lignes\.length > 1 \? trad\('Voir les \{n\} lignes'\) : trad\('Voir la ligne'\)\)\.replace\('\{n\}', j\.lignes\.length\)/.test(f),
      'le bouton compte toutes les lignes du jour, comme son total');
    vrai(f.indexOf('if (j.toutHorsSeance)') < f.indexOf('class="jour-plus"'),
      'hors séance, pas de bouton : la ligne compacte dit tout');
  });
});

/* ------------------------------------------------------------------
   Le journal des achats dit ce qu'il est
   ------------------------------------------------------------------ */
suite('Le journal des achats porte une bulle d’aide', () => {
  test('un carnet de certains achats, pas un relevé', () => {
    const src = lireSource('assets/app.js');
    const fn = src.slice(src.indexOf('function carteAchats('), src.indexOf('function champsAchat('));
    vrai(/<h2>\$\{trad\('Journal des achats'\)\}\$\{aide\(trad\(AIDE_JOURNAL_ACHATS\)\)\}<\/h2>/.test(fn), 'le « ? » suit le titre');
    const m = src.match(/const AIDE_JOURNAL_ACHATS = '([^']+)';/);
    vrai(m && /certains achats uniquement/.test(m[1]), 'certains achats, pas tous');
    vrai(m && I18N.en[m[1]], 'et la bulle est traduite');
  });
});

/* ------------------------------------------------------------------
   Une valeur a verifier se nomme, se lit et se corrige ou elle mene
   ------------------------------------------------------------------ */
suite('Une valeur à vérifier mène à l’endroit où elle se corrige', () => {
  test('le compte se nomme par son nom, jamais par son identifiant', () => {
    Fixture.poser();
    const s = structuredClone(Store.state);
    const i = s.comptes.findIndex(c => (c.cash || []).length);
    s.comptes[i].cash[0].montant = -12.5;
    const m = signalerInvalides(s);
    eq(m.length, 1, 'un seul champ marqué');
    eq(m[0].chemin, `comptes.${i}.cash.0.montant`);
    eq(m[0].nom, nomCompteV2(s.comptes[i]), 'le nom affiché dans Actifs');
    vrai(m[0].nom !== s.comptes[i].id, 'pas l’identifiant interne');
  });
  test('corriger la valeur la retire de la liste au même enregistrement', () => {
    /* Store.save() ecrit dans le stockage que la page de tests partage avec la
       demo : le recalcul se prouve par le calcul lui-meme, et sa place dans
       save() par le source. */
    Fixture.poser();
    const s = structuredClone(Store.state);
    const i = s.comptes.findIndex(c => (c.cash || []).length);
    s.comptes[i].cash[0].montant = -12.5;
    eq(signalerInvalides(s).length, 1, 'la valeur fautive est signalée');
    s.comptes[i].cash[0].montant = 12.5;
    eq(signalerInvalides(s).length, 0, 'et elle sort de la liste dès qu’elle est corrigée');
    const st = lireSource('assets/store.js');
    const corps = st.slice(st.indexOf('  save(opts = {}) {'), st.indexOf('canUndo()', st.indexOf('  save(opts = {}) {')));
    const ici = corps.indexOf('this.state.meta.aVerifier = signalerInvalides(this.state);');
    vrai(ici > corps.indexOf('refreshAccounts();'), 'save() relit la liste après la projection des comptes');
    vrai(ici > 0 && ici < corps.indexOf('localStorage.setItem'), 'et avant d’écrire, pour que la liste enregistrée soit la bonne');
  });
  test('la carte ouvre la fiche du compte et dit le montant en clair', () => {
    const a = lireSource('assets/app.js');
    const d = a.indexOf('function carteAVerifier()');
    const c = a.slice(d, a.indexOf('\nfunction ', d + 1));
    vrai(/action: 'fiche-compte', attrs: `data-id="\$\{esc\(compte\.id\)\}"`/.test(c), 'un compte ouvre sa fiche');
    vrai(/const montant = chiffre && n < 0 \? fmtEUR\(n\) : String\(e\.valeur\);/.test(c) && /esc\(quoi\(e\)\)/.test(c),
      'un montant négatif est formaté, un montant hors plafond reste tel quel');
    vrai(!/esc\(String\(e\.valeur\)\)/.test(c), 'plus de nombre brut');
    vrai(/trad\(solde \? 'un solde ne peut pas être négatif' : 'ce montant ne peut pas être négatif'\)/.test(c),
      'la raison suit le champ : un solde, ou un autre montant');
    vrai(/const raison = chiffre && n < 0/.test(c), 'et elle ne se dit que pour un montant négatif');
    for (const k of ['Voir le compte', 'un solde ne peut pas être négatif', 'ce montant ne peut pas être négatif',
                     'solde négatif, à corriger', 'valeur à vérifier'])
      vrai(I18N.en[k], 'traduite : ' + k);
  });
  test('la fiche marque le champ fautif', () => {
    const a = lireSource('assets/app.js');
    vrai(/aVerifier\(\)\.some\(x => x\.chemin === `comptes\.\$\{idx\}\.cash\.\$\{i\}\.montant`\) \? ' aria-invalid="true"' : ''/.test(a),
      'le champ porte aria-invalid');
    vrai(/trad\(num\(e\.montant\) < 0 \? 'solde négatif, à corriger' : 'valeur à vérifier'\)/.test(a),
      'et une mention sous son nom, qui ne dit « négatif » que d’un solde négatif');
    vrai(/input\[aria-invalid="true"\] \{ border-color: var\(--critical\); \}/.test(lireSource('assets/styles.css')),
      'et un bord qui le dit');
  });
});

/* ------------------------------------------------------------------
   La croix qui vide un champ se pose du cote libre
   ------------------------------------------------------------------ */
suite('La croix qui vide un champ ne couvre pas le montant', () => {
  test('un montant aligné à droite reçoit la croix à gauche', () => {
    const a = lireSource('assets/app.js');
    const f = a.slice(a.indexOf('function monteVideChamp('), a.indexOf('function monteVideChamp(') + 9000);
    vrai(/\/right\|end\/\.test\(getComputedStyle\(el\)\.textAlign\)\s*\n?\s*&& !el\.closest\('\.champ-somme'\) \? 'Left' : 'Right'/.test(f),
      'le côté se lit sur l’alignement, et le « + » garde la gauche');
    vrai(/btn\.style\.left = `\$\{cote === 'Left' \? r\.left \+ 3 : r\.right - 23\}px`;/.test(f), 'la croix suit ce côté');
    vrai(/cible\.style\['padding' \+ cote\] = '28px';/.test(f) && /cible\.style\['padding' \+ cote\] = padAvant \|\| '';/.test(f),
      'la réserve se pose et se retire du même côté');
  });
});

/* ------------------------------------------------------------------
   La suite de tests se decoupe sans rien perdre
   ------------------------------------------------------------------ */
suite('La suite de tests se découpe sans rien perdre', () => {
  test('chaque partie porte ses deux marqueurs, à sa place', () => {
    vrai(PARTIES_DE_TESTS.length >= 10, 'la suite vit en plusieurs parties');
    for (const p of PARTIES_DE_TESTS) {
      const t = lireSource(p);
      vrai(t !== null, `${p} est lisible`);
      vrai(t.startsWith(`partieDeTests('${p}');\n`), `${p} s’ouvre sur son marqueur`);
      vrai(t.endsWith(`finDePartieDeTests('${p}');\n`), `${p} se ferme sur le sien`);
      vrai(new TextEncoder().encode(t).length < 200000, `${p} reste sous 200 Ko`);
    }
  });
  test('la page charge le manifeste, dans son ordre', () => {
    const html = lireSource('tests.html');
    const tests = [...html.matchAll(/<script src="(tests\/[^"?]+)\?v=/g)].map(m => m[1]);
    eq(tests.join(' '), ['tests/sources.js', 'tests/harness.js', 'tests/fixture.js', ...PARTIES_DE_TESTS].join(' '),
      'les balises de tests.html suivent le manifeste');
    eq(partiesDeTestsManquantes().join(), '', 'et chaque partie s’est exécutée jusqu’au bout');
  });
  test('le fichier reconstitué ne porte aucun marqueur', () => {
    const t = lireSource('tests/store.tests.js');
    vrai(t && !/^(?:partieDeTests|finDePartieDeTests)\(/m.test(t), 'lireSource rend le texte d’origine');
    vrai(t.includes("suite('La suite de tests se découpe sans rien perdre'"), 'y compris cette suite');
  });
  test('une partie manquante se nomme, même quand elle vide la sélection', () => {
    vrai(/if \(partiel && !choix\.length && !manquantes\.length\) \{/.test(lireSource('tests/harness.js')),
      'cibler la partie absente rend son nom, pas « aucune suite »');
  });
  test('une partie ciblée choisit les suites qu’elle déclare', () => {
    const derniere = PARTIES_DE_TESTS.find(p => /^tests\/24-/.test(p));
    const choix = Tests.choisir({ touche: derniere });
    vrai(choix.some(s => s.nom === 'La suite de tests se découpe sans rien perdre'), 'cette suite en fait partie');
    vrai(choix.every(s => s.partie === derniere), 'et rien d’une autre partie');
  });
});

/* ------------------------------------------------------------------
   Les fichiers de l'application se decoupent sans rien perdre
   ------------------------------------------------------------------ */
suite('Les fichiers de l’application se découpent sans rien perdre', () => {
  const pages = () => [['index.html', lireSource('index.html')], ['tests.html', lireSource('tests.html')]];
  const balises = html => [...html.matchAll(/<(?:script src|link rel="stylesheet" href)="(assets\/[^"?]+)\?v=/g)].map(m => m[1]);
  test('le registre des parties est le premier script de chaque page', () => {
    for (const [nom, html] of pages()) {
      const premier = html.match(/<script src="([^"?]+)\?v=/);
      eq(premier && premier[1], 'assets/parties.js', `${nom} charge d’abord le registre`);
    }
  });
  test('chaque page charge un groupe en entier, d’un seul tenant, dans l’ordre du registre', () => {
    /* Les groupes que chaque page DOIT charger : sans cette liste, une page qui
       perdrait toutes ses feuilles sauterait le controle, et les routes se
       diraient rendues sans aucun style. tests.html ne charge pas la vue. */
    const attendus = { 'index.html': ['assets/i18n.js', 'assets/store.js', 'assets/app.js', 'assets/styles.css'],
                       'tests.html': ['assets/i18n.js', 'assets/store.js', 'assets/styles.css'] };
    for (const [nom, html] of pages()) {
      const vues = balises(html);
      for (const g of attendus[nom])
        vrai(GROUPES[g].every(p => vues.includes(p)), `${nom} charge tout ${g}`);
      for (const [groupe, liste] of Object.entries(GROUPES)) {
        const ici = vues.filter(p => liste.includes(p));
        if (!ici.length) continue;
        eq(ici.join(' '), liste.join(' '), `${nom} charge ${groupe} en entier et dans l’ordre`);
        const debut = vues.indexOf(liste[0]);
        eq(vues.slice(debut, debut + liste.length).join(' '), liste.join(' '), `${nom} : ${groupe} d’un seul tenant`);
      }
      for (const groupe of Object.keys(GROUPES))
        vrai(!html.includes(`"${groupe}?`), `${nom} ne charge plus ${groupe} d’un bloc`);
    }
  });
  test('chaque partie JS porte son marqueur, et se compile seule', () => {
    for (const [groupe, liste] of Object.entries(GROUPES)) {
      if (!groupe.endsWith('.js')) continue;
      liste.forEach((p, k) => {
        const t = lireSource(p);
        vrai(t !== null, `${p} est lisible`);
        const marque = `partieChargee('${p}');\n`;
        eq(t.split(marque).length - 1, 1, `${p} porte son marqueur une fois`);
        const derniere = groupe === 'assets/app.js' && k === liste.length - 1;
        vrai(derniere ? t.includes(marque + '(async function init() {\n') : t.endsWith(marque),
          derniere ? `${p} se marque juste avant init()` : `${p} se termine par son marqueur`);
        try { new Function(t); } catch (e) { vrai(false, `${p} ne se compile pas seule : ${e.message}`); }
      });
    }
  });
  test('aucune partie ne regrossit', () => {
    for (const liste of Object.values(GROUPES))
      for (const p of liste) {
        const o = new TextEncoder().encode(lireSource(p)).length;
        const plafond = 200000;
        vrai(o < plafond, `${p} : ${o} octets, sous ${plafond}`);
      }
  });
  test('le dictionnaire reconstitué est celui que la page a chargé', () => {
    /* Sur l'arbre publie, chaque partie s'ouvre sur l'en-tete de licence : il
       ne fait pas partie des coutures. */
    const [p1, p2, p3] = GROUPES['assets/i18n.js'].map(p => lireSource(p).replace(LIGNE_MARQUEUR, '')
      .replace(/^\/\*![\s\S]*?\*\/\n/, ''));
    const S = 'Object.assign(I18N.en, {\n', Z = '});\n', C = '  },\n};\n';
    vrai(p1.endsWith(C) && p2.startsWith(S) && p2.endsWith(Z) && p3.startsWith(S), 'les coutures sont à leur place');
    const debut = p1.indexOf('const I18N = {\n  en: {\n');
    const e3 = p3.slice(S.length, p3.indexOf(Z, S.length));
    const litteral = p1.slice(debut, -C.length) + p2.slice(S.length, -Z.length) + e3 + C;
    const refait = new Function(litteral + 'return I18N;')();
    const k1 = Object.keys(refait.en), k2 = Object.keys(I18N.en);
    eq(k1.length, k2.length, 'autant de clefs');
    eq(k1.join('\u0001'), k2.join('\u0001'), 'les mêmes, dans le même ordre');
    vrai(k1.every(k => String(refait.en[k]) === String(I18N.en[k])), 'avec les mêmes valeurs');
  });
  test('la version se lit encore sur les balises', () => {
    const src = lireSource('assets/app.js');
    const m = src.match(/const VERSION_APP = \(\(\) => \{\n  const s = \[\.\.\.document\.scripts\]\.map\(x => x\.src\)\.find\(x => (\/[^\n]+\/)\.test\(x\)\);/);
    vrai(m, 'VERSION_APP porte son motif');
    const motif = new Function('return ' + m[1])();
    const srcs = [...lireSource('index.html').matchAll(/<script src="([^"]+)"/g)].map(x => x[1]);
    vrai(srcs.some(s => motif.test(new URL(s, location.href).href)), 'et il trouve une balise d’index.html');
  });
  test('le démarrage vérifie ses parties, et le rendu se signale', () => {
    const src = lireSource('assets/app.js');
    const init = src.slice(src.indexOf('(async function init() {'));
    vrai(/^\(async function init\(\) \{\n(?:  \/\*[\s\S]*?\*\/\n)?  if \(partiesManquantes\(\)\.length\) \{ signalerPartiesManquantes\(\); return; \}/.test(init),
      'la première instruction d’init() vérifie les parties');
    vrai(/  render\(\);\n[\s\S]{0,300}?apresDeuxTrames\(signalerRendu\);/.test(init),
      'le premier rendu se signale après deux trames');
    vrai(/catch \(e\) \{\n    console\.error\(e\);\n    signalerErreur\(e\);/.test(src), 'une vue qui lève fait échouer le contrôle');
  });
  test('le lanceur contrôle douze routes, et le registre garde le premier échec', () => {
    const x = lireSource('executer-tests.py');
    const routes = [...x.matchAll(/^    \("(#\/[a-z]+)", "([a-zA-Z]+)"\),\r?$/gm)];
    eq(routes.length, 12, 'douze routes, redirections comprises');
    vrai(/method="PUT"/.test(x), '/json/new se demande en PUT');
    vrai(/time\.sleep\(4\)\n        with urllib\.request\.urlopen\(cdp \+ "\/json\/list"/.test(x),
      'les onglets restent ouverts après le signal, et le titre est relu');
    const r = lireSource('assets/parties.js');
    vrai(/if \(!ECHEC_DE_CHARGEMENT\) ECHEC_DE_CHARGEMENT = m;/.test(r) && /CONTROLE && !ECHEC_DE_CHARGEMENT/.test(r),
      'un succès ne réécrit jamais un échec');
    vrai(/if \(document\.visibilityState === 'hidden'\) \{ setTimeout\(fn, 0\); return; \}/.test(r),
      'un onglet caché se signale sans attendre de trame');
  });
});

/* ------------------------------------------------------------------
   Les actions vivent par domaine
   ------------------------------------------------------------------ */
suite('Les actions vivent par domaine, et aucune ne se perd', () => {
  const fichiers = () => GROUPES['assets/app.js'].filter(p => /\/app-08-actions-[a-z]+\.js$/.test(p));
  const sans = t => t.replace(LIGNE_MARQUEUR, '').replace(ENTETE_DE_LICENCE, '');
  test('un littéral, puis un Object.assign par domaine', () => {
    const f = fichiers();
    vrai(f.length >= 5, 'les actions vivent en plusieurs fichiers');
    vrai(/\nconst ACTIONS = \{\n/.test(lireSource(f[0])), 'le premier déclare ACTIONS');
    for (const p of f.slice(1))
      vrai(sans(lireSource(p)).startsWith('Object.assign(ACTIONS, {\n'), `${p} complète ACTIONS`);
  });
  test('chaque fichier, exécuté seul, ajoute ses actions à ACTIONS', () => {
    /* tests.html ne charge pas la vue : chaque fichier s'execute ici dans un
       contexte isole. Ce qui est prouve : sa syntaxe, et que son enveloppe
       ajoute bien ses clefs a ACTIONS. La page reelle est prouvee par son
       marqueur et par les douze routes. */
    const deleter = () => () => {};
    const f = fichiers();
    const t0 = sans(lireSource(f[0]));
    const litteral = t0.slice(t0.indexOf('const ACTIONS = {'), t0.indexOf('\n};', t0.indexOf('const ACTIONS = {')) + 3);
    const actions = new Function('makeDeleter', litteral + '\nreturn ACTIONS;')(deleter);
    for (const p of f.slice(1)) {
      const avant = Object.keys(actions).length;
      new Function('ACTIONS', 'makeDeleter', 'partieChargee', lireSource(p))(actions, deleter, () => {});
      vrai(Object.keys(actions).length > avant, `${p} ajoute des actions`);
    }
    /* Les noms lus dans les fichiers d'actions eux-memes, sans filtre : une
       action declaree mais absente de l'objet execute doit se voir. */
    const declarees = f.flatMap(p => [...sans(lireSource(p)).matchAll(/^ {2}(?:async )?'([a-z0-9-]+)'\s*[:(]/gm)].map(m => m[1]));
    eq(declarees.length, new Set(declarees).size, 'aucun nom déclaré deux fois');
    eq([...declarees].sort().join(' '), Object.keys(actions).sort().join(' '),
      'les clefs de l’objet exécuté sont exactement les noms déclarés');
  });
  test('une action se lit par son propre texte, jamais par sa voisine', () => {
    const src = lireSource('assets/app.js');
    const a = membreAction(src, 'refresh-quotes');
    vrai(a.startsWith("  async 'refresh-quotes'(") && a.endsWith('\n  },\n'), 'une méthode, de son nom à sa virgule');
    vrai(!a.includes("'cloud-push'"), 'sans la suivante');
  });
});

/* ------------------------------------------------------------------
   Les especes bougent par des parts designees, et rien ne s'ecrit a moitie
   ------------------------------------------------------------------ */
suite('Les espèces bougent par des parts désignées', () => {
  const poser = (f) => Fixture.poser(s => {
    s.comptes.find(c => c.id === 'c_cto').cash = [{ montant: 500, affectation: 'investir' }];
    s.positions.push({ id: 'p_a', name: 'Titre A', isin: '', symbol: 'TA', currency: 'EUR', qty: 10,
                       buyPrice: 150, price: 200, fx: 1, fxBuy: 1, account: 'c_cto', manual: false,
                       assetClass: 'actions', role: 'satellite' });
    if (f) f(s);
  });
  const pa = () => Store.state.positions.findIndex(p => p.id === 'p_a');
  const cash = (id, partie) => num((compteById(id).cash || []).find(e => e.affectation === partie)?.montant);
  const photo = () => JSON.stringify(Store.state);

  test('une part est désignée, jamais déduite', () => {
    poser();
    eq(partieSuggeree('c_courant'), 'courant', 'la part naturelle du compte courant');
    eq(partieSuggeree('c_cto'), 'investir', 'celle du compte-titres');
    vrai(!mouvementCash('c_courant', -100), 'sans part, rien ne bouge');
    vrai(!mouvementCash('c_courant', -100, 'investir'), 'une part absente ne se crée pas au passage');
    eq(cash('c_courant', 'courant'), 3000);
    vrai(mouvementCash('c_courant', -100, 'courant'), 'la part désignée paie');
    eq(cash('c_courant', 'courant'), 2900);
  });

  test('un débit ne rend jamais une part négative', () => {
    poser();
    vrai(!mouvementCash('c_courant', -5000, 'courant'), 'le débit trop grand est refusé');
    eq(cash('c_courant', 'courant'), 3000, 'et rien n’a bougé');
    vrai(/Il n’y a que/.test(verifierMouvement('c_courant', -5000, 'courant')), 'le refus dit le disponible');
  });

  test('un compte ambigu ne paie ni ne reçoit', () => {
    poser(s => { s.comptes.find(c => c.id === 'c_courant').cash = [
      { montant: 1000, affectation: 'courant' }, { montant: 500, affectation: 'courant' }]; });
    vrai(partiesDeCash('c_courant').every(x => x.ambigue), 'les deux parts sont marquées');
    vrai(!mouvementCash('c_courant', 100, 'courant'), 'aucun mouvement');
    eq(partieSuggeree('c_courant'), null, 'et rien n’est proposé');
  });

  test('un achat vérifie tout avant d’écrire', () => {
    poser();
    const avant = photo();
    const r = acheterTitres({ index: pa(), qty: 10, price: 100, source: { compteId: 'c_cto', partie: 'investir' } });
    vrai(r.erreur, 'mille euros sur une part de cinq cents : refusé');
    eq(photo(), avant, 'et l’état n’a pas bougé d’un octet');
    const ok = acheterTitres({ index: pa(), qty: 10, price: 100, source: { compteId: 'c_courant', partie: 'courant' } });
    vrai(!ok.erreur && ok.debite, 'payé depuis le compte courant');
    eq(Store.state.positions[pa()].qty, 20); eq(Store.state.positions[pa()].buyPrice, 125, 'le PRU pondéré');
    eq(cash('c_courant', 'courant'), 2000, 'le compte courant paie');
  });

  test('un titre étranger ne se paie qu’au taux reçu pour cette devise de base', () => {
    poser(s => { s.positions.find(p => p.id === 'p_a').currency = 'USD';
                 s.quotes = { fx: { USD: 0.9 }, fxBase: 'XXX' }; });
    eq(tauxDeChange('USD'), null, 'un taux d’une autre devise de base ne compte pas');
    vrai(acheterTitres({ index: pa(), qty: 1, price: 100, source: { compteId: 'c_courant', partie: 'courant' } }).erreur,
      'sans taux fiable, pas de débit');
    Store.state.quotes.fxBase = deviseBase();
    const r = acheterTitres({ index: pa(), qty: 1, price: 100, source: { compteId: 'c_courant', partie: 'courant' } });
    eq(r.coutBase, 90, 'cent dollars à 0,9'); eq(cash('c_courant', 'courant'), 2910);
  });

  test('la quantité finale reste dans ses bornes', () => {
    poser();
    vrai(acheterTitres({ index: pa(), qty: 1e12, price: 1, source: null }).erreur, 'au-delà de la borne des quantités');
    eq(Store.state.positions[pa()].qty, 10, 'la ligne n’a pas bougé');
  });

  test('une vente exige sa date, et une destination ouverte', () => {
    poser();
    const avant = photo();
    vrai(sellPosition({ index: pa(), qty: 5, price: 200, fxSell: 1, cashAccount: 'c_courant', cashPart: 'courant', date: '' }).erreur,
      'sans date, pas de vente');
    compteById('c_courant').statut = 'archive';
    vrai(sellPosition({ index: pa(), qty: 5, price: 200, fxSell: 1, cashAccount: 'c_courant', cashPart: 'courant', date: '2026-09-01' }).erreur,
      'vers un compte archivé, pas de vente');
    compteById('c_courant').statut = 'ouvert';
    eq(photo(), avant, 'et rien n’a été écrit');
  });

  test('la vente retient sa part, et son annulation reprend exactement celle-là', () => {
    poser();
    const v = sellPosition({ index: pa(), qty: 5, price: 200, fxSell: 1, cashAccount: 'c_courant', cashPart: 'courant', date: '2026-09-01' });
    vrai(v && !v.erreur, 'la vente passe');
    eq(Store.state.sales[0].cashPart, 'courant', 'la part créditée est retenue');
    eq(cash('c_courant', 'courant'), 4000);
    const r = annulerVente(0);
    vrai(r && !r.erreur, 'l’annulation passe');
    eq(cash('c_courant', 'courant'), 3000, 'la même part rend le produit');
    eq(Store.state.positions[pa()].qty, 10, 'les titres reviennent');
  });

  test('une annulation refusée ne touche à rien', () => {
    poser();
    sellPosition({ index: pa(), qty: 5, price: 200, fxSell: 1, cashAccount: 'c_courant', cashPart: 'courant', date: '2026-09-01' });
    compteById('c_courant').cash[0].montant = 100;
    const avant = photo();
    vrai(verifierAnnulation(0), 'l’argent a été dépensé depuis');
    vrai(annulerVente(0).erreur, 'l’annulation est refusée');
    eq(photo(), avant, 'ni les titres, ni le journal, ni le cash');
    compteById('c_courant').cash[0].montant = 5000;
    compteById('c_courant').statut = 'archive';
    vrai(annulerVente(0).erreur, 'une destination archivée refuse aussi');
  });

  test('une cession sans produit s’annule, et une vente ancienne se lit sur sa part d’origine', () => {
    poser(s => { s.sales = [{ id: 's1', cession: 'defaut', gross: 0, perimetre: 'interne', cashAccount: 'c_courant',
                              account: 'c_pe', date: '2026-09-01', ligneIndex: 0 }]; });
    eq(verifierAnnulation(0), null, 'un produit nul n’a rien crédité, rien à reprendre');
    eq(partieDeVente({ cashAccount: 'c_courant' }), 'investir', 'une vente d’avant se lit sur « à investir »');
    eq(partieDeVente({ cashAccount: 'ancien' }), 'solde', 'et un ancien compte sur son solde');
    eq(partieDeVente({ cashAccount: 'c_courant', cashPart: 'courant' }), 'courant', 'la part retenue gagne');
  });

  test('le transfert crédite la part choisie, et seulement elle', () => {
    poser(s => { s.comptes.find(c => c.id === 'c_courant').cash = [
      { montant: 3000, affectation: 'courant' }, { montant: 0, affectation: 'projet' }]; });
    const solde = soldeTransferable(compteById('c_livret'));
    const r = archiverParTransfert({ source: 'c_livret', destination: 'c_courant', partie: 'projet', montant: solde });
    vrai(r.ok, 'le transfert passe');
    eq(cash('c_courant', 'projet'), solde, 'la part choisie reçoit');
    eq(cash('c_courant', 'courant'), 3000, 'l’autre ne bouge pas');
    vrai(!archiverParTransfert({ source: 'c_pea', destination: 'c_courant', montant: 10 }).ok, 'sans part désignée, rien');
  });

  test('la semaine se compte en jours civils', () => {
    eq(prochaineEcheance({ echeanceLe: '2026-10-20', period: 'semaine' }, '2026-10-27'), '2026-10-27',
      'le passage à l’heure d’hiver ne saute pas l’échéance');
    eq(prochaineEcheance({ echeanceLe: '2026-12-29', period: 'semaine' }, '2027-01-04'), '2027-01-05', 'ni le passage d’année');
    const st = lireSource('assets/store.js');
    vrai(!/7 \* 864e5/.test(st), 'plus de pas fixe en millisecondes');
  });

  test('une vente passée reste dans ses bornes, et porte sa date', () => {
    Fixture.poser();
    vrai(declarerVente({ date: '', name: 'X', gross: 10, realised: 1 }).erreur, 'sans date, rien');
    vrai(declarerVente({ date: '2025-01-01', name: 'X', gross: 1e12, realised: -1e12 }).erreur,
      'un prix de revient impossible se refuse');
    eq((Store.state.sales || []).length, 0, 'rien n’est entré au journal');
  });

  test('les gestes vérifient avant d’écrire, et sauvegardent l’état d’avant', () => {
    const a = lireSource('assets/app.js');
    const del = membreAction(a, 'del-sale');
    vrai(del.indexOf('verifierAnnulation(i)') > 0 && del.indexOf('verifierAnnulation(i)') < del.indexOf('askConfirm(trad(\'Annuler cette vente ?\')'),
      'le refus se dit avant la question');
    vrai(/const avant = structuredClone\(Store\.state\);\n    const r = annulerVente\(i\);\n    if \(!r \|\| r\.erreur\)[^\n]*\n    Store\.addBackup\('avant annulation de vente', avant\);/.test(del),
      'la sauvegarde garde l’état d’avant, et seulement après un succès');
    vrai(/const r = acheterTitres\(a\);/.test(membreAction(a, 'open-position')), 'l’achat passe par le modèle');
    vrai(/verifierVente\(v\)/.test(a) && /verifierCession\(\{ compteId, index, \.\.\.v \}\)/.test(a) && /verifierDeclaration\(v\)/.test(a),
      'les fenêtres de vente vérifient avant de se fermer');
    vrai(/listeDeParts\(cibles, auto \|\| defaultCashTarget\(sourceId\), \{ credit: true \}\)/.test(a), 'la destination se choisit parmi des parts');
    vrai(/if \(cible\.value !== garde\) cible\.dispatchEvent\(new Event\('change', \{ bubbles: true \}\)\);/.test(a),
      'les listes liées se recalculent en chaîne');
    vrai(/const brouillon = await resoudreLigne\(bouton\.dataset\.symbol, cote\);/.test(a) && /creerLigneAchetee\(\{ ligne, brouillon, debit \}\)/.test(a),
      'l’ajout par recherche se résout en brouillon, puis s’écrit d’un coup');
    vrai(/e\.affectation === f\.value/.test(a), 'la fiche refuse deux parts de même affectation');
    vrai(/if \(!libre\) \{ toast\(trad\('Les quatre affectations sont déjà prises sur ce compte\.'\)\); return; \}/.test(a),
      'scinder ne crée pas de doublon');
  });
});

/* ------------------------------------------------------------------
   Les cas limites des especes : chacun a failli passer
   ------------------------------------------------------------------ */
suite('Les cas limites des espèces ne passent pas', () => {
  const poser = (f) => Fixture.poser(s => {
    s.comptes.find(c => c.id === 'c_cto').cash = [{ montant: 500, affectation: 'investir' }];
    s.positions.push({ id: 'p_a', name: 'Titre A', isin: '', symbol: 'TA', currency: 'EUR', qty: 10,
                       buyPrice: 150, price: 200, fx: 1, fxBuy: 1, account: 'c_cto', manual: false,
                       assetClass: 'actions', role: 'satellite' });
    s.comptes.push({ id: 'c_soc', etabId: 'e_pe', type: 'pe', statut: 'ouvert', ouvertLe: '2020-01-01', numero: '',
      notes: '', libelle: 'Société', court: 'Société', alloc: '', cash: [],
      lignes: [{ id: 'l_soc', classe: 'nonCote', libelle: 'Société', valeur: 4000, prixDeRevient: 2000,
                 parts: 4000, quantite: 1, dateAcquisition: '', estimeLe: todayISO() }] });
    if (f) f(s);
  });
  const pa = () => Store.state.positions.findIndex(p => p.id === 'p_a');
  const photo = () => JSON.stringify(Store.state);

  test('un débit arrondi à zéro est refusé', () => {
    poser();
    const avant = photo();
    vrai(acheterTitres({ index: pa(), qty: 1, price: 0.001, source: { compteId: 'c_courant', partie: 'courant' } }).erreur,
      'un millième d’euro ne se débite pas');
    eq(photo(), avant, 'et les titres n’entrent pas sans que rien ne sorte');
    vrai(verifierAjout({ qty: 1, buyPrice: 0.001, brouillon: { devise: 'EUR', fx: 1 },
                         debit: { compteId: 'c_courant', partie: 'courant' } }).debit, 'l’ajout le refuse aussi');
  });

  test('une affectation en double rend tout le compte ambigu', () => {
    poser(s => { s.comptes.find(c => c.id === 'c_courant').cash = [
      { montant: 1000, affectation: 'courant' }, { montant: 500, affectation: 'courant' },
      { montant: 300, affectation: 'projet' }]; });
    vrai(!mouvementCash('c_courant', 100, 'projet'), 'même la troisième part ne bouge pas');
    vrai(verifierMouvement('c_courant', 100, 'projet'), 'et le refus se dit');
  });

  test('une part nouvelle ne vaut que pour l’affectation naturelle d’un compte sans part', () => {
    poser();
    vrai(!mouvementCash('c_courant', 100, 'fantaisie+'), 'une affectation inventée ne se crée pas');
    vrai(!mouvementCash('c_courant', 100, 'courant+'), 'ni sur un compte qui a déjà ses parts');
    compteById('c_cto').cash = [];
    vrai(mouvementCash('c_cto', 100, 'investir+'), 'la part naturelle d’un compte sans part se crée, pour un crédit');
    vrai(!mouvementCash('c_cto', -10, 'projet+'), 'et rien d’autre');
  });

  test('une date impossible ne passe pas', () => {
    vrai(!dateISOValide('2026-02-30'), 'le 30 février');
    vrai(!dateISOValide('2026-13-01'), 'un treizième mois');
    vrai(dateISOValide('2028-02-29'), 'une année bissextile reste valide');
  });

  test('un champ vide n’est pas un zéro déclaré', () => {
    Fixture.poser();
    vrai(declarerVente({ date: '2025-01-01', name: 'X', gross: '', realised: 10 }).erreur, 'encaissé vide');
    vrai(declarerVente({ date: '2025-01-01', name: 'X', gross: 100, realised: '' }).erreur, 'résultat vide');
    poser();
    vrai(verifierVente({ index: pa(), qty: 1, price: '', fxSell: 1, date: '2026-09-01' }), 'prix de vente vide');
    eq((Store.state.sales || []).length, 0);
  });

  test('le capital investi final reste dans ses bornes, à l’achat comme à la vente', () => {
    poser(s => { const p = s.positions.find(x => x.id === 'p_a'); p.qty = 1e9; p.buyPrice = 2000; });
    vrai(acheterTitres({ index: pa(), qty: 1e9, price: 900, source: null }).erreur, 'un achat qui doublerait mille milliards');
    vrai(verifierVente({ index: pa(), qty: 1e9, price: 0, fxSell: 1, date: '2026-09-01' }), 'une vente dont l’investi dépasse la borne');
  });

  test('une cession ne dépasse pas les parts détenues', () => {
    poser();
    vrai(verifierCession({ compteId: 'c_soc', index: 0, parts: 5000, produit: 100, date: '2026-09-01' }), '5 000 parts sur 4 000');
    eq(verifierCession({ compteId: 'c_soc', index: 0, parts: 4000, produit: 100, date: '2026-09-01' }), null, 'toutes les parts, oui');
  });

  test('une annulation qui ne peut pas restaurer sa source est refusée', () => {
    poser();
    sellPosition({ index: pa(), qty: 5, price: 200, fxSell: 1, cashAccount: 'c_courant', cashPart: 'courant', date: '2026-09-01' });
    compteById('c_cto').statut = 'archive';
    vrai(annulerVente(0).erreur, 'le compte qui portait la ligne est archivé');
    compteById('c_cto').statut = 'ouvert';
    const c = cederPlacement({ compteId: 'c_soc', index: 0, parts: 1000, produit: 1000, cashAccount: 'c_courant',
                               cashPart: 'courant', date: '2026-09-01' });
    vrai(c && !c.erreur, 'une cession partielle');
    compteById('c_soc').lignes = [];
    const avant = photo();
    vrai(annulerVente(0).erreur, 'la ligne restante a disparu : on ne sait plus la restaurer');
    eq(photo(), avant, 'et rien n’a bougé, cash compris');
  });

  test('le taux d’un brouillon reste dans la borne des changes', () => {
    vrai(verifierAjout({ qty: 1, buyPrice: 1, brouillon: { devise: 'USD', fx: 2e6 }, debit: null }).erreur,
      'un taux aberrant ne crée pas de ligne');
  });

  test('les fenêtres ne choisissent pas une part à la place de l’utilisateur', () => {
    const a = lireSource('assets/app.js');
    vrai(/options\.unshift\(\[PART_A_CHOISIR, trad\('Choisis une part'\)\]\);/.test(a), 'sans suggestion, la liste s’ouvre sur « Choisis une part »');
    vrai(/if \(x\.cash === PART_A_CHOISIR\)/.test(a) && /x\.partie === PART_A_CHOISIR/.test(a)
      && (a.match(/lireDestination\('(ce|ve)'\) === PART_A_CHOISIR/g) || []).length === 2,
      'et chaque fenêtre refuse de se fermer sans choix');
    vrai(/\$\('#veFxWrap'\)\.hidden = devise === deviseBase\(\);/.test(a), 'le change se demande dès que la devise n’est pas celle du profil');
  });
});

/* ------------------------------------------------------------------
   Une annulation rend exactement ce qui avait ete pris
   ------------------------------------------------------------------ */
suite('Une annulation rend exactement ce qui avait été pris', () => {
  const poser = (f) => Fixture.poser(s => {
    s.comptes.find(c => c.id === 'c_cto').cash = [{ montant: 500, affectation: 'investir' }];
    s.positions.push({ id: 'p_a', name: 'Titre A', isin: '', symbol: 'TA', currency: 'EUR', qty: 10,
                       buyPrice: 100, price: 100, fx: 1, fxBuy: 1, account: 'c_cto', manual: false,
                       assetClass: 'actions', role: 'satellite' });
    s.comptes.push({ id: 'c_soc', etabId: 'e_pe', type: 'pe', statut: 'ouvert', ouvertLe: '2020-01-01', numero: '',
      notes: '', libelle: 'Société', court: 'Société', alloc: '', cash: [],
      lignes: [{ id: 'l_soc', classe: 'nonCote', libelle: 'Société', valeur: 4000, prixDeRevient: 2000,
                 parts: 4000, quantite: 1, dateAcquisition: '', estimeLe: todayISO() }] });
    if (f) f(s);
  });
  const pa = () => Store.state.positions.findIndex(p => p.id === 'p_a' || p.symbol === 'TA');
  const photo = () => JSON.stringify(Store.state);

  test('un montant reçu effacé n’est pas une perte totale', () => {
    poser();
    vrai(verifierCession({ compteId: 'c_soc', index: 0, parts: 1000, produit: '', date: '2026-09-01' }),
      'le montant reçu vide est refusé');
    eq(verifierCession({ compteId: 'c_soc', index: 0, parts: 1000, produit: 0, date: '2026-09-01' }), null,
      'un zéro tapé, lui, se déclare');
  });

  test('un produit qui s’arrondit à zéro se journalise à zéro, sans crédit', () => {
    poser();
    const v = sellPosition({ index: pa(), qty: 1, price: 0.001, fxSell: 1, cashAccount: 'c_courant', cashPart: 'courant',
                             date: '2026-09-01' });
    vrai(v && !v.erreur, 'la vente passe');
    eq(Store.state.sales[0].gross, 0, 'le journal dit zéro');
    eq(num(compteById('c_courant').cash[0].montant), 3000, 'et le compte n’a rien reçu : les deux disent la même chose');
  });

  test('une vente dont le compte source a disparu ne s’annule pas', () => {
    poser();
    sellPosition({ index: pa(), qty: 10, price: 100, fxSell: 1, cashAccount: 'c_courant', cashPart: 'courant', date: '2026-09-01' });
    Store.state.comptes = Store.state.comptes.filter(c => c.id !== 'c_cto');
    const avant = photo();
    vrai(annulerVente(0).erreur, 'aucune ligne ne renaît sur un compte qui n’existe plus');
    eq(photo(), avant);
  });

  test('une cession partielle ne s’annule que sur la ligne qu’elle a laissée', () => {
    poser();
    cederPlacement({ compteId: 'c_soc', index: 0, parts: 1000, produit: 1000, cashAccount: 'c_courant',
                     cashPart: 'courant', date: '2026-09-01' });
    vrai(Store.state.sales[0].ligneApres, 'l’état de la ligne restante est retenu');
    compteById('c_soc').lignes[0].valeur = 9999;
    vrai(annulerVente(0).erreur, 'la ligne a changé depuis : on n’y additionne pas les anciens montants');
  });

  test('le capital final se borne aussi une fois converti', () => {
    poser(s => { const p = s.positions.find(x => x.id === 'p_a'); p.qty = 6e8; p.buyPrice = 1000; p.fx = 2; p.currency = 'USD'; });
    vrai(acheterTitres({ index: pa(), qty: 1, price: 1000, source: null }).erreur,
      '600 milliards en devise, sous la borne, en font 1 200 une fois convertis');
  });

  test('l’annulation rend les titres à leur prix de revient', () => {
    poser();
    sellPosition({ index: pa(), qty: 5, price: 100, fxSell: 1, cashAccount: 'c_courant', cashPart: 'courant', date: '2026-09-01' });
    acheterTitres({ index: pa(), qty: 5, price: 200, source: null });
    eq(Store.state.positions[pa()].buyPrice, 150, 'le rachat fait monter le PRU');
    vrai(!annulerVente(0).erreur, 'l’annulation passe');
    const p = Store.state.positions[pa()];
    eq(p.qty, 15);
    pres(p.buyPrice, 133.3333, 'dix titres à 150 et cinq rendus à 100');
  });

  test('l’annulation ne fait pas déborder la ligne qui reçoit', () => {
    poser(s => { const p = s.positions.find(x => x.id === 'p_a'); p.qty = 1e12 - 1; p.buyPrice = 0.0001; p.price = 0.0001; });
    sellPosition({ index: pa(), qty: 1, price: 1, fxSell: 1, cashAccount: '', date: '2026-09-01' });
    acheterTitres({ index: pa(), qty: 2, price: 0.0001, source: null });
    vrai(verifierAnnulation(0), 'mille milliards plus un : refusé');
  });

  test('un demi-centime crédité se reprend en entier', () => {
    poser();
    sellPosition({ index: pa(), qty: 1, price: 0.005, fxSell: 1, cashAccount: 'c_courant', cashPart: 'courant', date: '2026-09-01' });
    eq(num(compteById('c_courant').cash[0].montant), 3000.01, 'le crédit arrondi au centime');
    vrai(!annulerVente(0).erreur, 'l’annulation passe');
    eq(num(compteById('c_courant').cash[0].montant), 3000, 'et le même centime repart');
  });

  test('les parts restantes se comparent à leur propre précision', () => {
    poser();
    cederPlacement({ compteId: 'c_soc', index: 0, parts: 1000, produit: 1000, cashAccount: 'c_courant',
                     cashPart: 'courant', date: '2026-09-01' });
    compteById('c_soc').lignes[0].parts = 2999.999;
    vrai(annulerVente(0).erreur, 'un millième de part de moins se voit');
  });

  test('une cession partielle annulée rend chaque élément du coût', () => {
    poser(s => { const l = s.comptes.find(c => c.id === 'c_soc').lignes[0];
                 delete l.prixDeRevient; l.prixAchat = 1500; l.fraisAcquisition = 300; l.travauxInitiaux = 200; });
    const avant = JSON.stringify(compteById('c_soc').lignes[0]);
    cederPlacement({ compteId: 'c_soc', index: 0, parts: 1000, produit: 1000, cashAccount: 'c_courant',
                     cashPart: 'courant', date: '2026-09-01' });
    eq(num(compteById('c_soc').lignes[0].prixAchat), 1125, 'la cession réduit le prix d’achat');
    vrai(!annulerVente(0).erreur, 'l’annulation passe');
    eq(JSON.stringify(compteById('c_soc').lignes[0]), avant, 'la ligne revient à l’identique');
  });

  test('le journal porte le montant crédité, au centime', () => {
    poser();
    sellPosition({ index: pa(), qty: 1, price: 0.005, fxSell: 1, cashAccount: 'c_courant', cashPart: 'courant', date: '2026-09-01' });
    sellPosition({ index: pa(), qty: 1, price: 0.005, fxSell: 1, cashAccount: 'c_courant', cashPart: 'courant', date: '2026-09-01' });
    eq(round2(Store.state.sales.reduce((t, v) => t + num(v.gross), 0)), 0.02, 'deux centimes au journal');
    eq(num(compteById('c_courant').cash[0].montant), 3000.02, 'comme dans le compte');
  });

  test('le résultat journalisé part du produit crédité', () => {
    poser(s => { const p = s.positions.find(x => x.id === 'p_a'); p.qty = 2; p.buyPrice = 0.01; });
    sellPosition({ index: pa(), qty: 1, price: 0.005, fxSell: 1, cashAccount: 'c_courant', cashPart: 'courant', date: '2026-09-01' });
    sellPosition({ index: pa(), qty: 1, price: 0.005, fxSell: 1, cashAccount: 'c_courant', cashPart: 'courant', date: '2026-09-01' });
    eq(round2(Store.state.sales.reduce((t, v) => t + num(v.realised), 0)), 0,
      'deux centimes investis, deux centimes crédités : aucun résultat');
  });

  test('l’aperçu dit le résultat que le journal inscrira', () => {
    poser(s => { const p = s.positions.find(x => x.id === 'p_a'); p.qty = 2; p.buyPrice = 0.01; });
    const ap = salePreview(Store.state.positions[pa()], 1, 0.005, 1);
    const v = sellPosition({ index: pa(), qty: 1, price: 0.005, fxSell: 1, cashAccount: 'c_courant', cashPart: 'courant', date: '2026-09-01' });
    eq(ap.realised, Store.state.sales[0].realised, 'l’aperçu et le journal');
    eq(v.realised, Store.state.sales[0].realised, 'le message de réussite et le journal');
    eq(ap.gross, Store.state.sales[0].gross, 'et le même produit');
  });

  test('un zéro déclaré depuis la cession empêche l’annulation', () => {
    poser();
    cederPlacement({ compteId: 'c_soc', index: 0, parts: 1000, produit: 1000, cashAccount: 'c_courant',
                     cashPart: 'courant', date: '2026-09-01' });
    compteById('c_soc').lignes[0].fraisAcquisition = 0;
    vrai(annulerVente(0).erreur, 'la saisie faite depuis ne s’efface pas');
  });

  test('la destination devient une liste dès qu’il y a à choisir', () => {
    vrai(/if \(auto && sugg && optionsDeParts\(\[compteById\(auto\)\], \{ credit: true \}\)\.length <= 1\)/.test(lireSource('assets/app.js')),
      'le texte fixe ne vaut que pour une seule part');
  });
});
finDePartieDeTests('tests/24-chaque-categorie-repartition-s.tests.js');
