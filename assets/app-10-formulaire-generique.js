/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */
function champSomme(html) {
  return `<span class="champ-somme">${html}<button type="button" class="somme-plus"
    tabindex="-1" title="${trad('Additionner un autre montant dans ce champ')}"
    aria-label="${trad('Additionner un autre montant dans ce champ')}">+</button></span>`;
}

/* Le « + » s'ajoute à la fin, jamais au curseur : le gestionnaire de focus
   sélectionne le champ entier à l'entrée, donc `selectionStart` vaut 0, et une
   insertion au curseur aurait soit refusé d'écrire, soit remplacé le montant.
   C'est de toute façon le sens du bouton — un autre montant s'ajoute à la suite.

   Deux refus, pour ne jamais rendre la saisie invalide : rien à additionner à un
   champ vide, et pas de « + » sur un « + ». */
function insererPlus(champ) {
  if (!champ) return;
  const texte = String(champ.value).replace(/\s+$/, '');
  if (!/\d$/.test(texte)) { champ.focus(); return; }
  champ.value = `${texte}+`;
  const q = champ.value.length;
  const placerCurseur = () => {
    try { champ.setSelectionRange(q, q); } catch (e) {}
    champ.scrollLeft = champ.scrollWidth;
  };
  /* Passer après le gestionnaire de focus global, qui sélectionne tout une image
     après la prise de focus : sans ce décalage le chiffre suivant effaçait la
     somme. Inutile quand le champ a déjà le focus, ce que `onmousedown` garantit
     dans le cas courant. */
  if (document.activeElement === champ) placerCurseur();
  else { champ.focus(); requestAnimationFrame(() => requestAnimationFrame(placerCurseur)); }
  champ.dispatchEvent(new Event('input', { bubbles: true }));
}

function cablerSommePlus(racine) {
  for (const b of racine.querySelectorAll('.somme-plus')) {
    b.onmousedown = e => e.preventDefault();
    b.onclick = () => insererPlus(b.previousElementSibling);
  }
}

function ecrireDepensesMois(index, saisi) {
  const r = Store.state.budget.expenses[index];
  if (!r || !saisi) return null;
  /* `v: null` veut dire « garde ce que l'etat porte » : le retour du decoupage
     vient de le reecrire, et renvoyer la saisie d'avant l'ecraserait. */
  if (saisi.v != null) r.v = saisi.v;
  r.note = saisi.note;
  Store.save();
  return r;
}

async function nePlusDetaillerPartout({ index = null, saisie = null } = {}) {
  const i = index != null ? index
    : Store.state.budget.expenses.findIndex(r => r.month === todayISO().slice(0, 7) + '-01');
  const ligne = i >= 0 ? Store.state.budget.expenses[i] : null;
  const v = saisie ? saisie.v : (ligne ? (ligne.v || {}) : {});
  const montants = Object.keys(v).filter(k => num(v[k]));
  const total = montants.reduce((s, k) => s + num(v[k]), 0);
  const question = `${trad('Ne garder qu’une case à remplir ?')}\n`
    + trad('Une seule case à remplir, ce mois-ci et les suivants.')
    + (montants.length > 1
      ? '\n' + trad('Les {n} montants de ce mois se regroupent sur cette case, soit {v}.')
          .replace('{n}', montants.length).replace('{v}', fmtEUR0(total))
      : '');
  if (!await askConfirm(question, { danger: false, ok: trad('Une seule case') })) return null;
  Store.addBackup('avant regroupement des dépenses');
  const garde = neePlusDetailler();
  /* `regrouperMois` garde le decoupage d'avant sur la ligne, avec son total :
     c'est ce qui permet a « Reprendre le detail » de rendre les montants. */
  if (ligne) regrouperMois(ligne, garde);
  Store.save();
  return { garde, total };
}

function remettreLeDetail() {
  const fait = reprendreLeDetail();
  if (fait.categories || fait.mois) Store.save();
  return fait;
}

function phraseRetourDetail(fait) {
  const cat = `${fait.categories} ${fait.categories > 1
    ? trad('catégories reviennent dans la saisie') : trad('catégorie revient dans la saisie')}`;
  if (!fait.mois) return cat;
  return `${cat}, ${trad('et les montants de')} ${fait.mois} ${fait.mois > 1
    ? trad('mois regroupés') : trad('mois regroupé')}`;
}

function askExpenseMonth(index) {
  return new Promise(resolve => {
    const r = Store.state.budget.expenses[index];
    if (!r) { resolve(null); return; }
    const cats = expenseCategories()
      .filter(c => !categorieRetiree(c) || num(r.v?.[c]));
    const repliees = sansDistinction()
      ? cats.filter(c => categorieRetiree(c) && num(r.v?.[c]))
      : [];
    const ouvertes = cats.filter(c => !repliees.includes(c));
    const cible = num(Store.state.budget.monthlyTarget);
    const m = $('#modal');
    apercuOuvert = null;

    $('#modalTitle').textContent = `${trad('Dépenses de')} ${fmtMonth(r.month)}`;
    $('#modalSub').innerHTML = cible ? `${trad('Objectif mensuel :')} ${fmtEUR0(cible)}` : '';
    $('#modalBody').innerHTML = `
      <div class="dep-total" id="depTotal"></div>
      ${(() => {
        const grille = liste => `
      <div class="dep-grille">
        ${liste.map(c => `
          <div class="field dep-champ" data-champ="${esc(c)}">
            <label class="dep-lab"><span>${esc(c)}</span></label>
            ${champSomme(`<input type="text" inputmode="decimal" data-cat="${esc(c)}"
                   value="${r.v?.[c] ?? ''}" placeholder="" autocomplete="off">`)}
          </div>`).join('')}
      </div>`;
        if (!repliees.length) return grille(ouvertes);
        const somme = repliees.reduce((s, c) => s + num(r.v?.[c]), 0);
        return grille(ouvertes) + `
      <details class="data-view" style="margin-top:12px">
        <summary>${(repliees.length > 1
            ? trad('{n} montants déjà répartis, {v}')
            : trad('{n} montant déjà réparti, {v}'))
          .replace('{n}', repliees.length).replace('{v}', fmtEUR0(somme))}</summary>
        ${grille(repliees)}
      </details>`;
      })()}
      <div class="row" style="margin-top:12px">
        ${sansDistinction() ? ''
          : `<button class="btn sm ghost" id="depNouvelleCat" type="button"
              >${trad('+ Nouvelle catégorie')}</button>`}
        <span class="garde-ensemble">${sansDistinction()
          ? `<button class="btn sm ghost" id="depRemettreDetail" type="button"
              >${trad('Remettre toutes les catégories')}</button>`
          : `<button class="btn sm ghost" id="depSansDetail" type="button"
              >${trad('Une seule case à remplir')}</button>`}
        ${aide(trad('Plusieurs dépenses dans une catégorie : tape-les additionnées, 100+50+70. '
          + 'Le + du champ écrit le signe, que le pavé numérique n’a pas. Pour suivre deux '
          + 'choses séparément, fais deux catégories.'))}</span>
      </div>
      <div class="field" style="margin-top:12px">
        <label>${trad('Note du mois')}</label>
        <textarea id="depNote" rows="3"
                  placeholder="${trad('Ce qui explique ce mois-là…')}">${esc(r.note || '')}</textarea>
      </div>`;
    $('#modalFoot').innerHTML =
      `<button class="btn ghost sm sans-coupure" id="depAutres" type="button">${trad('Autres mois')}</button>
       <span class="spacer"></span>
       <button class="btn" id="depOk" type="button">${trad('Enregistrer')}</button>
       <button class="btn ghost" id="depFermer" type="button">${trad('Fermer')}</button>`;
    montrerModal(m);

    const champs = $$('#modalBody [data-cat]');
    const champDe = cat => champs.find(c => c.dataset.cat === cat);
    /* Un « + » sans rien après est un geste inachevé, pas une saisie invalide :
       on l'ignore au lieu de rejeter le champ entier. Deux conséquences, et la
       seconde est grave. Le total tombait à zéro entre le clic sur « + » et la
       frappe du second montant. Et surtout, un « 157+ » laissé en place valait
       zéro à l'enregistrement : `saisie()` fait `if (!t) continue`, donc la
       catégorie quittait `v`, et le 157 déjà saisi était perdu sans un mot. Le
       bouton qui met le « + » à portée d'un doigt rendait cette perte facile.

       `parseSomme()` n'est pas touchée : elle continue de rejeter ce qui est
       vraiment invalide, et ce rejet ne devient jamais un zéro ici. */
    const valeurChamp = el => parseSomme(String(el.value).replace(/[+\s]+$/, ''))?.total ?? 0;

    const majTotal = () => {
      const t = champs.reduce((s, c) => s + valeurChamp(c), 0);
      const ecart = t - cible;
      $('#depTotal').innerHTML = `
        <span class="dep-somme">${fmtEUR(t)}</span>
        ${cible ? `<span class="dep-ecart ${classeDepassement(t, cible)}">
          ${ecart > 0 ? '▲' : '▼'} ${fmtSigned(Math.abs(ecart) * (ecart > 0 ? 1 : -1))} ${trad('vs objectif')}</span>` : ''}`;
    };

    for (const c of champs) {
      c.oninput = () => majTotal();
      c.onchange = () => {
        const s = parseSomme(c.value);
        c.value = s ? (s.total || '') : (r.v?.[c.dataset.cat] ?? '');
        majTotal();
      };
    }
    cablerSommePlus($('#modalBody'));
    majTotal();
    focusChamp(champs[0]);

    if ($('#depSansDetail')) $('#depSansDetail').onclick = regrouperCeMois;
    if ($('#depRemettreDetail')) $('#depRemettreDetail').onclick = remettreDetailIci;
    /* Le bouton n'existe pas quand les categories sont desactivees : le garder
       cable sans garde aurait leve sur un `null` au premier rendu du mode
       « une seule case ». Ses deux voisins portaient deja ce garde. */
    if ($('#depNouvelleCat')) $('#depNouvelleCat').onclick = async () => {
      /* La saisie se relève **avant** d'ouvrir la question par-dessus : les
         deux fenêtres partagent le même corps, et `saisie()` cherchait le
         champ de note dans un panneau qu'`askText` venait de remplacer. Elle
         échouait en silence, la fenêtre se fermait et rien ne revenait. */
      const etat = saisie();
      const nom = await askText('Nouvelle catégorie de dépenses',
        'Elle devient une colonne du tableau, vide sur tous les autres mois.', 'ex. Abonnements');
      if (!nom) { fermer({ ...etat, rouvrir: true }); return; }
      if (!addExpenseCategory(nom)) {
        toast(trad('Cette catégorie existe déjà'));
        fermer({ ...etat, rouvrir: true });
        return;
      }
      Store.save();
      fermer({ ...etat, rouvrir: true });
    };

    /* Le geste vit dans `nePlusDetaillerPartout()`, avec celui de la carte :
       deux portes, un seul comportement. Ici on ne fait que lui passer le mois
       ouvert et ce qui y est saisi, puis rouvrir la fenetre sur le resultat.

       Declarees, et non posees dans des constantes : le branchement des boutons
       tourne plus haut que ces lignes, et une constante n'existe pas avant sa
       declaration. Le meme piege que `peindre()` sur la fiche d'une ligne, et il
       casse tout le reste de la fenetre en silence. */
    async function regrouperCeMois() {
      const etat = saisie();
      const fait = await nePlusDetaillerPartout({ index, saisie: etat });
      if (!fait) { fermer({ ...etat, rouvrir: true }); return; }
      fermer({ v: fait.total ? { [fait.garde]: round2(fait.total) } : {},
               note: etat.note, rouvrir: true });
    }

    function remettreDetailIci() {
      const etat = saisie();
      const fait = remettreLeDetail();
      if (fait.categories || fait.mois) toast(phraseRetourDetail(fait));
      fermer({ v: null, note: etat.note, rouvrir: true });
    }

    const fermer = v => {
      masquerModal(m);      $('#modalClose').onclick = null;
      resolve(v);
    };
    const saisie = () => {
      const v = {};
      for (const c of champs) {
        const cat = c.dataset.cat;
        const t = valeurChamp(c);
        if (!t) continue;
        v[cat] = round2(t);
      }
      return { v, note: $('#depNote').value };
    };
    /* L'etat de depart, releve par la fonction meme qui enregistre.

       Comparer deux `saisie()` plutot que poser un drapeau sur chaque champ :
       il y a ici trois sortes de saisie — les montants de categorie, le detail
       ligne a ligne, la note du mois — et un drapeau se serait tot ou tard
       oublie sur la troisieme. Ce qui compte n'est pas qu'on ait touche un
       champ, c'est que ce qui partirait soit different de ce qui est arrive :
       taper 40 par-dessus 40 ne salit rien. */
    /* `depart` bouge : c'est ce qui permet d'enregistrer sans fermer.

       Il valait l'etat d'ouverture, une fois pour toutes. Enregistrer en cours
       de saisie l'aurait laisse en arriere, et fermer ensuite aurait redemande
       « modifications non enregistrees » pour des montants deja ecrits. Il
       marque desormais le dernier etat mis a l'abri, ouverture comprise. */
    let depart = JSON.stringify(saisie());
    const sale = () => JSON.stringify(saisie()) !== depart;

    const annulerOuDemander = async () => {
      if (!sale()) { fermer(null); return; }
      const garder = await askConfirm(trad('Modifications non enregistrées') + '\n'
        + trad('Les dépenses de {m} portent des changements qui ne sont pas encore dans tes données.')
            .replace('{m}', fmtMonth(r.month)),
        { ok: 'Enregistrer et fermer', refus: 'Fermer sans enregistrer', danger: false });
      fermer(garder ? saisie() : null);
    };

    const enregistrer = () => {
      const r2 = ecrireDepensesMois(index, saisie());
      depart = JSON.stringify(saisie());
      render();
      toast(`${fmtMonth(r.month)} · ${fmtEUR0(expenseRowTotal(r2 || r))}`);
    };

    $('#depFermer').onclick = annulerOuDemander;
    $('#modalClose').onclick = annulerOuDemander;
    $('#depOk').onclick = enregistrer;
    $('#depAutres').onclick = () => fermer({ ...saisie(), versTableau: true });
  });
}

/* La ligne d'un mois, creee si elle manque, et son index dans `monthly`.

   Le calendrier ouvre les douze mois de l'annee en cours et de chaque annee
   deja presente, mais pas ceux d'une annee qu'on n'a jamais touchee : rattraper
   un mois de 2019 ou preparer janvier prochain demande donc une ligne. Un seul
   endroit la cree, et il garde la table triee — la variation d'un mois se lit
   sur son voisin de gauche, un releve insere a la fin la fausserait.

   La cle est celle des lignes du releve, le premier du mois. */
function indexReleve(cle) {
  let i = Store.state.monthly.findIndex(r => r.date === cle);
  if (i < 0) {
    Store.state.monthly.push({ date: cle, comment: '', v: {} });
    Store.state.monthly.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    Store.save();
    i = Store.state.monthly.findIndex(r => r.date === cle);
  }
  return i;
}

function appliquerReleve(index, saisi) {
  const row = Store.state.monthly[index];
  if (!row) return false;
  sauvegardeAvantEcrasement(row);
  row.v = saisi.v;
  row.comment = saisi.comment;
  row.dettes = round2(num(saisi.dettes));
  row.parts = partsDuReleve(saisi.v);
  row.clotureLe = todayISO();
  delete row.poches;
  historyYear = String(row.date).slice(0, 4);
  Store.save(); render();
  return true;
}

async function viderOuSupprimerMois(index) {
  const r = Store.state.monthly[index];
  if (!r) return false;
  const calendrier = isCalendarMonth(r.date);
  if (!await askConfirm(calendrier
    ? trad('Effacer les montants de {m} ?').replace('{m}', fmtMonth(r.date)) + '\n\n'
      + trad('Ce mois quittera le journal : il ne porte plus de relevé. Le rajouter le '
           + 'remettra à sa place, dans l’ordre des dates.')
      + '\n\n' + trad('Réversible avec Ctrl+Z.')
    : trad('Supprimer la ligne du {d} ?').replace('{d}', fmtDate(r.date)) + '\n\n'
      + trad("Ce n'est pas un mois du calendrier : la ligne disparaîtra du journal.")
      + '\n\n' + trad('Réversible avec Ctrl+Z.'))) return false;
  if (calendrier) clearMonthRow(r, 'comment');
  else Store.state.monthly.splice(index, 1);
  Store.save();
  toast(calendrier ? `${fmtMonth(r.date)} ${trad('vidé')}`
                   : trad('releve.ligneSupprimee', 'Ligne supprimée'));
  return true;
}

/* Ce qui date, dit juste au-dessus du bouton qui va le figer.

   La liste vient de `aRafraichir()` et ne bloque rien : enregistrer reste
   possible, parce que le detenteur sait peut-etre que la valeur n'a pas bouge.
   Cinq lignes au plus, et le reste se compte : la fenetre doit laisser voir ses
   champs. */
function blocFraicheur() {
  const f = aRafraichir();
  if (!f.length) return '';
  const phrase = x => {
    const d = x.depuis ? esc(fmtDate(x.depuis)) : '';
    if (x.genre === 'cours') return d ? trad('Cours actualisés le {d}').replace('{d}', d) : trad('Cours jamais actualisés');
    if (x.genre === 'soldesSansDate') return `${trad('Soldes jamais vérifiés')}${deuxPoints()} ${
      x.noms.map(n => esc(guill(n))).join(', ')}`;
    const quoi = x.genre === 'aVerifier' ? trad('valeur à vérifier')
      : x.genre === 'solde' ? trad('solde vérifié le {d}').replace('{d}', d)
      : x.genre === 'credit' ? (d ? trad('capital restant dû vérifié le {d}').replace('{d}', d)
                                  : trad('capital restant dû jamais vérifié'))
      : x.releve ? (d ? trad('valeur au {d}').replace('{d}', d) : trad('valeur sans date'))
      : x.publiee ? (d ? trad('VL du {d}').replace('{d}', d) : trad('sans date de VL'))
      : (d ? trad('estimée le {d}').replace('{d}', d) : trad('sans date d’estimation'));
    return `${esc(guill(x.nom))}${deuxPoints()} ${quoi}`;
  };
  return `
      <div class="avert">
        <b>${trad('Certaines valeurs datent')}</b>
        <ul class="avert-liste">${f.slice(0, 5).map(x => `<li>${phrase(x)}</li>`).join('')}${f.length > 5
          ? `<li>${trad('et {n} autres').replace('{n}', f.length - 5)}</li>` : ''}</ul>
        ${trad('Le relevé les figera telles quelles. Tu peux les mettre à jour avant, ou enregistrer quand même.')}
      </div>`;
}

function askMonthlySnapshot(index) {
  return new Promise(resolve => {
    const r = Store.state.monthly[index];
    if (!r) { resolve(null); return; }
    const comptes = ACCOUNTS.slice();
    const montres = new Set(comptes.map(a => a.id));
    const masque = a => a.legacy && !num(r.v?.[a.id]);
    const masques = comptes.filter(masque).length;
    const avant = Store.state.monthly.slice(0, index).filter(x => !rowIsEmpty(x)).pop();
    const precedent = avant ? rowTotal(avant) : 0;
    const photo = nowTotals().total;
    const revolu = moisRevolu(r.date);
    const anCourant = +todayISO().slice(0, 4);
    const anMin = Math.min(anCourant,
      ...Store.state.monthly.map(x => +String(x.date).slice(0, 4))) - 10;
    const listeAnnees = [];
    for (let a = anMin; a <= anCourant + 1; a++) listeAnnees.push(a);
    const choixMois = isCalendarMonth(r.date);
    const m = $('#modal');
    apercuOuvert = null;

    $('#modalTitle').textContent = `${trad('Relevé de')} ${fmtMonth(r.date)}`;
    const premier = !Store.state.monthly.some((x, i) => i !== index && !rowIsEmpty(x));
    $('#modalSub').innerHTML = escMontant(premier
      ? `${trad('La photo de ton patrimoine pour {m}.').replace('{m}', fmtMonth(r.date))} ${
          trad('Chaque poche est préremplie avec sa valeur d’aujourd’hui : vérifie, corrige si besoin, puis enregistre.')}`
      : `${trad('Mets à jour la valeur de chaque poche pour enregistrer ton patrimoine de {m}.').replace('{m}', fmtMonth(r.date))}${
          avant ? ` ${trad('Dernier relevé,')} ${fmtMonth(avant.date)}${deuxPoints()} ${fmtEUR0(precedent)}.` : ''}`);
    $('#modalBody').innerHTML = `
      ${/* Le mois du releve, et il se change ici.

            « Ajouter un relevé » propose le mois en cours : c'est le cas
            quatre-vingt-dix-neuf fois sur cent. Le choix sert aux trois autres,
            tous nommes — rattraper un mois oublie, importer un ancien
            historique, corriger une periode passee. Il vit donc DANS la fenetre
            plutot que dans une etape avant elle : une etape de plus aurait fait
            payer un clic au cas courant pour un choix qu'il ne fait pas.

            Deux menus et non un champ de type « month » : Safari de bureau ne
            le connait pas et y rend une zone de texte libre, dans laquelle on
            peut ecrire n'importe quoi. */''}
      ${choixMois ? `
      <div class="row" style="gap:8px; margin:0 0 14px">
        <span class="hint">${trad('Mois du relevé')}</span>
        <select id="relMois" class="annee" title="${trad('Mois du relevé')}">
          ${moisCourts().map((nom, k) => `<option value="${String(k + 1).padStart(2, '0')}"${
            k + 1 === +String(r.date).slice(5, 7) ? ' selected' : ''}>${esc(nom)}</option>`).join('')}
        </select>
        <select id="relAn" class="annee" title="${trad('Année du relevé')}">
          ${listeAnnees.map(a => `<option value="${a}"${
            a === +String(r.date).slice(0, 4) ? ' selected' : ''}>${a}</option>`).join('')}
        </select>
      </div>` : ''}
      <div class="dep-total" id="relTotal"></div>
      ${/* Ton patrimoine est-il complet ? Une NOTE, pas une question : elle
            informe et ne bloque pas. Elle ne parait qu'au premier releve, et
            seulement si l'inventaire n'a pas deja ete declare complet dans le
            guide — repondre la-bas repond ici. Au premier releve enregistre,
            la question s'eteint d'elle-meme (inventaireDeclareComplet). */''}
      ${premier && !notifsMasquees().includes(CLE_INVENTAIRE) ? `
      <p class="avert" style="margin:0 0 14px"><b>${trad('Ton patrimoine est-il complet ?')}</b>
        ${trad('Ce relevé utilisera uniquement les comptes et actifs déjà ajoutés à Longward. Vérifie qu’il ne manque aucune poche importante avant d’enregistrer ton premier mois.')}
        <button type="button" class="lien-nu" id="relVerifier">${trad('Vérifier mes poches')}</button></p>` : ''}
      ${/* Sans avoirs saisis, la photo vaut zero : proposer d'ecraser douze
            champs avec des zeros n'aiderait personne. */''}
      ${/* Le bouton de photo est l'action principale, et il ne l'etait pas.

            Il est donc plein, pleine largeur, et son libelle dit ce qu'il fait
            plutot que de se nommer : « Reprendre les montants actuels » et le
            total qu'il va ecrire. La phrase en dessous degrade les champs a ce
            qu'ils sont vraiment — une surface de correction — et emploie les
            memes mots que le depliant de la page, pour que les deux ecrans
            racontent la meme chose.

            Sans avoirs saisis, la photo vaut zero : proposer d'ecraser douze
            champs avec des zeros n'aiderait personne, le bloc disparait. */''}
      ${/* Ce qui date se dit AVANT le bouton qui le reprend : lu apres, il
            arriverait une fois les montants perimes deja dans les champs. */''}
      ${photo && revolu ? blocFraicheur() : ''}
      ${photo && revolu ? `
      <button class="btn pleine" id="relPhoto" type="button"
              >⤒ ${trad('Préremplir avec les montants actuels')} · ${fmtEUR0(photo)}</button>
      ${/* La phrase d'aide redisait le bouton avec d'autres mots (« remplir
            automatiquement ») : deux formulations pour un geste. Elle dit
            maintenant ce que le bouton ne dit pas, d'ou viennent les valeurs,
            et qu'on peut corriger avant d'enregistrer. */''}
      <p class="hint" style="margin:6px 0 14px; text-align:center">${
        trad('Chaque poche reçoit sa valeur d’aujourd’hui ; tu peux corriger un champ avant d’enregistrer.')}</p>` : ''}
      ${revolu ? '' : `
      <p class="avert">${trad('Ce mois n’a pas encore eu lieu. Il n’y a pas de montants à en '
        + 'reprendre, et ce que tu saisirais ici serait lu comme un relevé passé.')}</p>`}
      <div class="dep-grille">
        ${comptes.map(a => `
          <div class="field"${masque(a) && !historyShowLegacy
            ? ' data-cloture="1" style="display:none"'
            : masque(a) ? ' data-cloture="1"' : ''}>
            <label title="${esc([a.label, a.broker].filter(Boolean).join(' · '))}"
              >${esc(a.label)}${a.fantome ? ` <span class="muted">(${trad('ancien modèle')})</span>`
              : a.legacy ? ` <span class="muted">(${trad('clôturé')})</span>` : ''}<span
                class="f-etab">${esc(a.broker || '')}</span></label>
            <input type="number" step="any" inputmode="decimal" data-compte="${esc(a.id)}"
                   value="${r.v?.[a.id] ?? ''}" placeholder="">
          </div>`).join('')}
      </div>
      ${masques ? `
      <label class="small row" style="gap:6px; margin-top:10px">
        <input type="checkbox" id="relCloture" ${historyShowLegacy ? 'checked' : ''} style="width:auto">
        ${trad('Afficher les comptes clôturés')} (${masques})
      </label>` : ''}
      <div class="field" style="margin-top:12px">
        <label>${trad('Crédits en cours ce mois-là ({dev})')}${aide(trad("Le total du capital restant dû à cette date. Il ne se soustrait pas des champs ci-dessus (ceux-ci portent la valeur brute de chaque compte), mais il fait monter la part nette de tes biens, mois après mois, à mesure que tu rembourses."))}</label>
        <input type="number" step="any" inputmode="decimal" id="relDettes"
               class="champ-large" value="${num(r.dettes) || ''}" placeholder="0">
      </div>
      <div class="field" style="margin-top:12px">
        <label>${trad('Commentaire du mois')}</label>
        <input id="relNote" value="${esc(r.comment || '')}" placeholder="${trad('Ce qui explique ce mois-là…')}">
      </div>
      <div class="fiche-danger">
        <button type="button" class="btn ghost danger" id="relVider">${
          isCalendarMonth(r.date) ? trad('Effacer ce relevé')
                                  : trad('releve.supprimerLigne', 'Supprimer cette ligne')}</button>
        <p class="hint">${isCalendarMonth(r.date)
          ? trad('Les montants partent, le mois reste dans la liste, vide : les douze mois '
            + 'de l’année s’affichent toujours.')
          : trad('Ce n’est pas un mois du calendrier : la ligne disparaît de la liste.')}</p>
      </div>`;
    $('#modalFoot').innerHTML =
      `<button class="btn" id="relOk" type="button">${trad('Enregistrer')}</button>
       <button class="btn ghost" id="relFermer" type="button">${trad('Fermer')}</button>`;
    montrerModal(m);

    const champs = $$('#modalBody [data-compte]');
    const majTotal = () => {
      const t = champs.reduce((s, c) => s + num(c.value), 0);
      const d = precedent && t ? t - precedent : 0;
      const dettes = num($('#relDettes')?.value);
      $('#relTotal').innerHTML = `
        <span class="dep-libelle">${trad('Total du relevé')}${aide(trad(
          'La somme des poches renseignées ci-dessous, en valeur brute. Les crédits en cours se notent à part, plus bas ; le total net apparaît alors dessous.'))}</span>
        <span class="dep-somme">${fmtEUR0(t)}</span>
        ${d ? `<span class="dep-ecart ${cls(d)}">
          ${d > 0 ? '▲' : '▼'} ${fmtSigned(d)} ${trad('depuis')} ${esc(fmtMonth(avant.date))}</span>` : ''}
        ${dettes ? `<span class="dep-ecart muted" style="flex-basis:100%">
          ${trad('net de crédits')}${deuxPoints()} <b>${fmtEUR0(t - dettes)}</b></span>` : ''}`;
    };
    let sale = false;
    const touche = () => { sale = true; majTotal(); };
    for (const c of champs) c.oninput = touche;
    $('#relDettes').oninput = touche;       // le net suit la frappe
    $('#relNote').oninput = () => { sale = true; };
    majTotal();
    /* Le focus va au bouton quand il existe.

       `focusChamp` ne conviendrait pas ici : il se tait sur ecran tactile, pour
       ne pas ouvrir le clavier, et il selectionne le contenu. Un bouton n'a ni
       clavier a ouvrir ni contenu a selectionner. */
    if ($('#relPhoto')) $('#relPhoto').focus({ preventScroll: true });
    else focusChamp(champs[0]);

    let photoPrise = false;
    if ($('#relPhoto')) $('#relPhoto').onclick = () => {
      for (const c of champs) {
        const v = nowValue(c.dataset.compte);
        /* Un compte ouvert a zero se photographie A ZERO : c'est ce que la photo
           voit, et le laisser vide ferait passer pour non renseigne un compte
           qu'on vient justement de regarder.

           Un compte CLOTURE a zero reste vide, lui : il n'existe plus, et
           l'ecrire a zero chaque mois remplirait le releve de comptes morts. Le
           cadre `data-cloture` est precisement ceux-la. */
        const cloture = c.closest('[data-cloture]');
        c.value = (v || !cloture) ? round2(v) : '';
        const boite = v ? c.closest('[data-cloture]') : null;
        if (boite) boite.style.display = '';
      }
      const detteJour = round2(patrimoine().dettes);
      $('#relDettes').value = detteJour || '';
      photoPrise = true;
      sale = true;
      majTotal();
      toast(trad('Champs préremplis avec les montants d’aujourd’hui : vérifie, puis enregistre'));
    };
    if (premier && $('#relPhoto') && !champs.some(c => String(c.value ?? '').trim() !== '')) { $('#relPhoto').onclick(); sale = false; }

    let ouverte = true;
    const fermer = v => {
      if (!ouverte) return;    // le premier releve ferme depuis « enregistrer », puis « quitter » repasse ici
      ouverte = false;
      masquerModal(m);      $('#modalClose').onclick = null;
      resolve(v);
    };
    const enregistrer = async () => {
      const v = {};
      for (const [k, val] of Object.entries(r.v || {})) if (!montres.has(k)) v[k] = val;
      /* LE CHAMP VIDE SE TAIT, LE ZERO SE DECLARE. Le test portait sur le
         MONTANT — `if (num(c.value))` — donc un zero tape a la main ne
         s'ecrivait jamais : le compte qu'on vient de vider ressortait comme un
         compte auquel on n'a pas repondu, et le releve entier passait pour vide
         s'il n'y avait que ca. C'est la seule saisie capable de declarer un
         compte a zero, et elle ne savait pas l'entendre.

         La question porte donc sur le REMPLISSAGE du champ, et le montant
         suit. */
      for (const c of champs) {
        const brut = String(c.value ?? '').trim();
        if (brut === '') continue;
        v[c.dataset.compte] = round2(num(brut));
      }
      if (!Object.keys(v).length && String($('#relDettes').value ?? '').trim() === '') {
        toast(trad('Aucun montant saisi. Renseigne au moins une poche, ou préremplis avec les montants d’aujourd’hui.'));
        return false;
      }

      if (!revolu && !await askConfirm(
          trad('Enregistrer un relevé pour {m} ?').replace('{m}', fmtMonth(r.date)) + '\n\n'
        + trad('Ce mois n’a pas encore eu lieu. La ligne comptera comme un relevé '
        + 'passé, dans les courbes comme dans les écarts d’un mois à l’autre.'),
          { ok: 'Enregistrer quand même' })) return false;

      if (photoPrise && !rowIsEmpty(r) && !await askConfirm(
          trad('Remplacer les montants de {m} ?').replace('{m}', fmtMonth(r.date)) + '\n\n'
        + `${trad('Enregistré :')} ${fmtEUR0(rowTotal(r))}\n`
        + `${trad('Après reprise :')} ${fmtEUR0(champs.reduce((s, c) => s + num(c.value), 0))}\n\n`
        + trad('Réversible : le message qui suit propose de revenir en arrière.'),
          { ok: 'Remplacer' })) return false;

      appliquerReleve(index, { v, comment: $('#relNote').value,
                               dettes: $('#relDettes').value });
      sale = false;
      photoPrise = false;
      if (premier) {
        const voir = await askConfirm(
          `${fmtMonth(r.date)} ${trad('enregistré')}\n${
            trad('Ton patrimoine de {m} est de {v}.').replace('{m}', fmtMonth(r.date))
              .replace('{v}', fmtEUR0(rowNet(Store.state.monthly[index])))}\n${
            trad('Ajoute un nouveau relevé le mois prochain pour suivre ton évolution.')}`,
          { danger: false, ok: trad('Voir mon historique'), refus: trad('Fermer') });
        fermer(true);
        if (voir) location.hash = '#/history';
        return true;
      }
      const ligne = Store.state.monthly[index];
      const brut = rowTotal(ligne), net = rowNet(ligne);
      toast(`${fmtMonth(r.date)} · ${Math.abs(brut - net) > 0.005
        ? `${fmtEUR0(brut)} ${trad('brut')} · ${fmtEUR0(net)} ${trad('net')}`
        : fmtEUR0(net)} ${trad('enregistré')}`);
      return true;
    };
    $('#relOk').onclick = enregistrer;
    const quitter = async () => {
      if (sale) {
        const garder = await askConfirm(trad('Modifications non enregistrées') + '\n'
          + trad('Ce relevé porte des montants qui ne sont pas encore dans tes données.'),
          { ok: 'Enregistrer et fermer', refus: 'Fermer sans enregistrer', danger: false });
        if (garder && !await enregistrer()) return;   // garde refusee : on reste
      }
      fermer(null);
    };
    $('#relFermer').onclick = quitter;
    $('#modalClose').onclick = quitter;
    if ($('#relVerifier')) $('#relVerifier').onclick = async () => {
      await quitter();
      if (!ouverte) location.hash = '#/accounts';
    };
    if ($('#relCloture')) $('#relCloture').onchange = () => {
      historyShowLegacy = $('#relCloture').checked;
      for (const b of $$('#modalBody [data-cloture]')) {
        b.style.display = historyShowLegacy ? '' : 'none';
      }
    };
    async function allerAuMois() {
      const cle = `${$('#relAn').value}-${$('#relMois').value}-01`;
      const remettre = () => {
        $('#relMois').value = String(r.date).slice(5, 7);
        $('#relAn').value = String(r.date).slice(0, 4);
      };
      if (cle === r.date) return;
      if (sale) {
        const garder = await askConfirm(trad('Modifications non enregistrées') + '\n'
          + trad('Ce relevé porte des montants qui ne sont pas encore dans tes données.'),
          { ok: 'Enregistrer puis changer', refus: 'Changer sans garder', danger: false });
        if (garder && !await enregistrer()) { remettre(); return; }
      }
      const j = indexReleve(cle);
      fermer(null);
      askMonthlySnapshot(j);
    }
    if ($('#relMois')) {
      $('#relMois').onchange = allerAuMois;
      $('#relAn').onchange = allerAuMois;
    }
    $('#relVider').onclick = async () => {
      if (!await viderOuSupprimerMois(index)) return;
      fermer(null);
      render();
    };
  });
}

const noteSansBase = r => !r.sansBase ? ''
  : trad(r.sansBase > 1 ? '{n} lignes sans prix de revient'
                        : '{n} ligne sans prix de revient').replace('{n}', String(r.sansBase));
/* Une ligne sans montant se range en fin de liste plutot que de se glisser
   parmi celles qui sont proches de zero : `null - x` vaut `-x`, donc un tri nu
   la traite comme un gain nul et la melange a des lignes qui, elles, ont ete
   mesurees. */
const parGainDecroissant = (a, b) =>
  (a.valeur == null) - (b.valeur == null) || b.valeur - a.valeur;

function blocMiseAJour(genre, aide) {
  return `
    <div class="apercu-maj">
      <b>${trad(genre === 'compte' ? 'Mettre à jour un compte' : 'Mettre à jour un actif')}</b>
      <span>${aide}</span>
    </div>`;
}

/* Les actifs d'une categorie, une rangee entiere par actif, au gabarit des
   listes de l'application : le nom et ce qui le porte, la valeur, le chevron.
   Une ligne cotee ouvre sa fiche de position, les autres la fiche du compte qui
   les porte, la ou leur valeur se corrige. Passe `montrer`, le reste attend le
   bouton qui deplie. */
function lignesActifs(lignes, montrer = 0) {
  return `
    <div class="mlist-groupe apercu-actifs">
      ${lignes.map((l, i) => `
      <button type="button" class="mlist${montrer && i >= montrer ? ' apercu-surplus' : ''}"
              ${l.ouvre ? `data-action="${esc(l.ouvre.action)}" data-i="${esc(String(l.ouvre.i))}"`
                : `data-action="aller-fiche" data-route="${esc(l.route)}"`}>
        <span class="ml-nom">${esc(l.label)}${l.meta ? `<span class="sub">${escMontant(l.meta)}</span>` : ''}</span>
        <span class="ml-chiffres"><b>${l.valeur == null
          ? `<span class="muted petit">${trad('prix de revient manquant')}</span>` : fmtEUR(l.valeur)}</b></span>
        <span class="ml-chev" aria-hidden="true">›</span>
        <span class="hors-ecran">, ${trad('ouvrir sa fiche pour le mettre à jour')}</span>
      </button>`).join('')}
      ${montrer && lignes.length > montrer ? `
      <button type="button" class="btn sm ghost apercu-plus" data-action="apercu-voir-tout">${
        trad('Voir les {n} autres').replace('{n}', lignes.length - montrer)}</button>` : ''}
    </div>`;
}

function detailVenteBien(v, r) {
  const e = round2(num(v.encaisse));
  const compte = v.cashAccount && compteById(v.cashAccount);
  return `
          <dt>${trad('Prix de vente, ta part')}</dt><dd>${fmtEUR(num(v.gross))}</dd>
          ${(v.dettesSoldees || []).length ? `<dt>${trad('Crédits soldés')}</dt><dd>${fmtEUR(num(v.rembourse))}</dd>` : ''}
          ${num(v.frais) ? `<dt>${trad('Frais de sortie du crédit')}</dt><dd>${fmtEUR(num(v.frais))}</dd>` : ''}
          <dt>${trad(e < 0 ? 'Débité' : 'Encaissé')}</dt><dd>${fmtEUR(Math.abs(e))}</dd>
          <dt>${trad('Coût d’acquisition')}</dt><dd>${v.invested == null
            ? trad('non renseigné') : fmtEUR(num(v.invested))}</dd>
          <dt>${trad('Plus-value')}</dt>
            <dd class="${r.fiable ? cls(r.montant) : 'muted'}"><b>${r.fiable
              ? fmtSigned(r.montant) : trad('non calculable')}</b></dd>
          ${compte ? `<dt>${trad(e < 0 ? 'Débité de' : 'Encaissé sur')}</dt><dd>${esc(nomCompteV2(compte))}</dd>` : ''}`;
}

const APERCUS = {
  classe: (classe) => {
    const p = patrimoine();
    const total = p.classes[classe] || 0;
    let lignes;
    if (classe === 'liquidites') {
      const groupes = AFFECTATIONS.map(([aff, label]) => {
        const entrees = [];
        Store.state.comptes.forEach((c, ic) => {
          if (c.statut === 'archive') return;
          (c.cash || []).forEach((e, j) => {
            if (e.affectation === aff) entrees.push({ c, ic, j, e });
          });
        });
        return { aff, label, entrees };
      }).filter(g => g.entrees.length);
      /* Le seuil porte sur leur somme, comme `liquiditesEnLignes` : deux
         lignes de quelques millimes font un total que le groupe doit refaire. */
      const supports = liquiditesEnLignes() === 0 ? [] : comptesOuverts().flatMap(c => lignesDe(c)
        .filter(l => l.classe === 'liquidites').map(l => ({ c, l })));
      const nbGroupes = groupes.length + (supports.length ? 1 : 0);

      const sommes = () => Object.fromEntries([
        ...groupes.map(g => [g.aff, fmtEUR(g.entrees.reduce((s, x) => s + num(x.e.montant), 0))]),
        ...(supports.length ? [['monetaire', fmtEUR(supports.reduce((s, x) => s + num(x.l.valeur), 0))]] : []),
      ]);

      return {
        titre: CLASSES_ACTIFS[classe],
        sous: `${groupes.length} ${groupes.length > 1 ? trad('usages') : trad('usage')} · ${trad('modifiable ici même')}`,
        total: poches().classes.liquidites,
        lignes: [],
        live: sommes,
        /* Le meme pli anime que les groupes de la page Actifs, et le meme
           bouton pour les mener tous : `.cpt-pli` passe sa rangee de 0fr a 1fr,
           seule facon d'animer une hauteur inconnue. `<details>` tenait ce role
           et ne s'anime pas — et surtout il n'offrait aucune prise pour un geste
           collectif, alors que c'est precisement ce qu'on vient faire ici :
           replier les usages pour comparer leurs totaux d'un coup d'oeil. */
        sousAction: nbGroupes > 1
          ? `<button type="button" class="btn sm ghost" data-action="liq-plier-tout"
                     aria-expanded="true">${trad('Tout replier')}</button>`
          : '',
        html: `
          ${groupes.map(g => `
          <section class="liq-groupe">
            <button type="button" class="liq-sommaire" data-action="liq-plier"
                    data-cle="${esc(cleLiqPli(g.aff))}"
                    aria-expanded="${compteReplies.has(cleLiqPli(g.aff)) ? 'false' : 'true'}">
              <span>${esc(g.label)}</span>
              <b data-live="${esc(g.aff)}">${sommes()[g.aff]}</b><span class="cpt-chev">⌄</span></button>
            <div class="cpt-pli ${compteReplies.has(cleLiqPli(g.aff)) ? '' : 'ouvert'}"><div class="liq-corps">
              ${g.entrees.map(x => {
                const etab = sousNom(nomCompteV2(x.c), nomEtabDe(x.c));
                return `
                <div class="liq-ligne">
                  <span class="cpt-nom">${esc(nomCompteV2(x.c))}${etab ? `<span class="sub">${esc(etab)}</span>` : ''}</span>
                  <input type="number" step="any" class="champ-inline"
                         data-path="comptes.${x.ic}.cash.${x.j}.montant" value="${num(x.e.montant)}"
                         aria-label="${esc(trad('Solde, {c}').replace('{c}', nomCompteV2(x.c)))}">
                </div>`; }).join('')}
            </div></div>
          </section>`).join('')}
          ${!supports.length ? '' : `
          <section class="liq-groupe">
            <button type="button" class="liq-sommaire" data-action="liq-plier"
                    data-cle="${esc(cleLiqPli('monetaire'))}"
                    aria-expanded="${compteReplies.has(cleLiqPli('monetaire')) ? 'false' : 'true'}">
              <span>${esc(trad(LIBELLE_LIQUIDITES_EN_LIGNES))}</span>
              <b data-live="monetaire">${sommes().monetaire}</b><span class="cpt-chev">⌄</span></button>
            <div class="cpt-pli ${compteReplies.has(cleLiqPli('monetaire')) ? '' : 'ouvert'}"><div class="liq-corps">
              ${supports.map(({ c, l }) => `
                <div class="liq-ligne">
                  <span class="cpt-nom">${esc(l.libelle || nomCompteV2(c))}<span class="sub">${
                    esc(sousNom('', nomCompteV2(c), nomEtabDe(c)))}</span></span>
                  <b>${fmtEUR(l.valeur)}</b>
                </div>`).join('')}
              <p class="hint" style="margin:8px 0 0">${trad('Leur valeur vient de leur cours ou de leur fiche, pas d’une saisie ici.')}</p>
            </div></div>
          </section>`}`,
        avant: blocMiseAJour('compte', trad('Corrige le solde d’un compte ci-dessous, puis enregistre.')),
        calcule: true,
        vue: 'accounts', ancre: '', cta: trad('Ouvrir Actifs'),
      };
    }
    if (classe === 'immobilier') {
      /* Par compte, et non par lot : un credit finance un compte, il se lit et
         se retranche une fois. Voir `biensImmobiliersParCompte`. */
      const biens = biensImmobiliersParCompte();
      const creditTotal = biens.reduce((s, b) => s + b.du, 0);
      const duDe = b => b.dettes.reduce((s, x) => s + num(x.d.montant), 0);
      const vivants = () => Object.fromEntries(biens.flatMap((b, k) => [
        [`net-${k}`, fmtEUR(b.valeur - duDe(b))],
        [`credit-${k}`, `−${fmtEUR(duDe(b))}`],
      ]));
      const lot = (l, c) => {
        const gain = l.prixDeRevient ? l.valeur - l.prixDeRevient : null;
        const pct = l.prixDeRevient ? (l.valeur / l.prixDeRevient - 1) * 100 : null;
        const meta = sousNom(l.libelle, nomCompteV2(c), nomEtabDe(c));
        return `
            <div class="bien-tete">
              <span class="cpt-nom">${esc(l.libelle)}
                ${meta ? `<span class="sub">${esc(meta)}</span>` : ''}</span>
              <b>${fmtEUR(l.valeur)}</b>
            </div>
            <dl class="kv">
              ${l.part ? `
                <dt>${trad('Ta part')}</dt>
                  <dd>${fmtPct(l.part, 0)} ${trad('de')} ${fmtEUR0(l.valeurEntiere)}</dd>` : ''}
              ${gain != null ? `
                <dt>${trad('Prix d\'acquisition')}</dt><dd>${fmtEUR0(l.prixDeRevient)}</dd>
                <dt>${trad('Écart vs coût d’acquisition')}</dt>
                  <dd class="${cls(gain)}">${fmtSigned(gain)} <span class="muted">${fmtSignedPct(pct, 1)}</span></dd>`
                : `<dt>${trad('Prix d\'acquisition')}</dt><dd class="muted">${trad('non renseigné')}</dd>`}
              ${l.dateAcquisition ? `<dt>${trad('Acquis le')}</dt><dd>${fmtDate(l.dateAcquisition)}</dd>` : ''}
              ${usageLigne(l) ? `<dt>${trad('Usage')}</dt>
                <dd>${trad(USAGE_BIEN_LABEL[usageLigne(l)])}</dd>` : ''}
              <dt>${trad('Disponibilité')}</dt>
                <dd>${esc(trad(MOBILISABLE_LABEL[mobiliteLigne(l, c)]))}</dd>
            </dl>`;
      };
      return {
        titre: CLASSES_ACTIFS.immobilier,
        sous: (biens.length > 1 ? trad('{n} biens') : trad('{n} bien'))
            .replace('{n}', biens.length)
          + (creditTotal
            ? ` · ${trad('{v} net de crédits').replace('{v}', fmtEUR0(total - creditTotal))}`
            : ` · ${trad('sans crédit')}`),
        total, lignes: [], live: vivants,
        html: biens.map((b, k) => `
          <div class="bien">
            ${b.lots.map(l => lot(l, b.compte)).join('')}
            ${b.dettes.length ? `
              <div class="pret-vif">
                ${b.dettes.map(({ d, i }) => `
                  <div class="liq-ligne">
                    <span class="cpt-nom">${esc(d.libelle)}
                      <span class="sub">${trad('capital restant dû, à baisser après chaque mensualité')}</span></span>
                    <input type="number" step="any" class="champ-inline"
                           data-path="etabs.${b.idxEtab}.dettes.${i}.montant" value="${num(d.montant)}"
                           aria-label="${esc(trad('Capital restant dû, {l}')
                             .replace('{l}', d.libelle))}">
                  </div>`).join('')}
                <dl class="kv">
                  <dt>${trad('Crédits en cours')}</dt><dd class="dette" data-live="credit-${k}">−${fmtEUR(b.du)}</dd>
                  <dt><b>${trad('Ce que tu possèdes')}</b></dt>
                    <dd><b data-live="net-${k}">${fmtEUR(b.net)}</b></dd>
                </dl>
              </div>` : ''}
            <button class="btn sm ghost" data-action="aller-fiche"
                    data-route="#/compte/${encodeURIComponent(b.compte.id)}"
                    aria-label="${esc(trad('Mettre à jour {n}').replace('{n}', nomCompteV2(b.compte)))}"
                    >${trad('Mettre à jour ce bien')} →</button>
          </div>`).join('') || `<p class="empty">${trad('Aucun bien immobilier.')}</p>`,
        avant: blocMiseAJour('actif', trad('Ouvre la fiche d’un bien pour corriger sa valeur.')
          + (creditTotal ? ` ${trad('Le capital restant dû se corrige ici même.')}` : '')),
        calcule: true,
        vue: 'accounts', ancre: '', cta: trad('Ouvrir Actifs'),
      };
    }

    if (classe === 'actions') {
      const parts = classesDeMarche().map(g => ({
        label: g.label, valeur: g.valeur,
        meta: `${g.n} ${g.n > 1 ? trad('lignes') : trad('ligne')}`,
      }));
      return {
        titre: CLASSES_ACTIFS[classe] || classe,
        sous: `${parts.length} ${parts.length > 1 ? trad('classes') : trad('classe')}`,
        total, lignes: parts,
        avant: blocMiseAJour('actif', trad('Les cours s’actualisent dans Marchés. Ouvre une ligne pour corriger sa quantité ou son prix de revient.')),
        calcule: true,
        vue: 'positions', ancre: '', cta: trad('Ouvrir Marchés'),
      };
    }

    {
      lignes = [];
      for (const c of comptesOuverts()) {
        for (const l of lignesDe(c)) {
          if (l.classe !== classe) continue;
          const i = l.marche ? Store.state.positions.indexOf(l.marche) : -1;
          const nomL = nomLignePlacement(l, c);
          lignes.push({ label: nomL,
                        meta: sousNom(nomL, nomCompteV2(c), nomEtabDe(c)),
                        valeur: l.valeur,
                        ...(i >= 0 ? { ouvre: { action: 'open-position', i } }
                                   : { route: `#/compte/${encodeURIComponent(c.id)}` }) });
        }
      }
      lignes.sort((a, b) => b.valeur - a.valeur);
    }
    const surMarche = classe === 'obligations' || classe === 'crypto';
    const MONTREES = 8;
    const finance = num(dettesParDestination().classes[classe]);
    const montrer = lignes.length > MONTREES + 2 ? MONTREES : 0;
    return {
      titre: CLASSES_ACTIFS[classe] || classe,
      sous: `${trad(lignes.length > 1 ? '{n} placements' : '{n} placement').replace('{n}', lignes.length)}${finance > 0.005
        ? ` · ${trad('{v} net de crédits').replace('{v}', fmtEUR0(total - finance))}` : ''}`,
      total, lignes, montrer,
      avant: blocMiseAJour('actif', trad('Touche un actif pour ouvrir sa fiche et corriger sa valeur.')),
      html: lignesActifs(lignes, montrer),
      calcule: true,
      vue: surMarche ? 'positions' : 'accounts', ancre: '',
      cta: trad(surMarche ? 'Ouvrir Marchés' : 'Ouvrir Actifs'),
    };
  },

  cible: (cle) => ficheDeBarre(positionsDeCible(cle)),

  role: (role) => ficheDeBarre(positionsDeRole(role)),

  cash: (poche) => {
    const cle = AFFECTATION_LABEL[poche] ? poche : null;
    const lignes = [];
    Store.state.comptes?.forEach((c, idxCompte) => {
      if (c.statut === 'archive') return;
      (c.cash || []).forEach((e, idxCash) => {
        if (cle && e.affectation !== cle) return;
        lignes.push({ label: nomCompteV2(c),
          meta: [nomEtabDe(c), cle ? '' : AFFECTATION_LABEL[e.affectation]].filter(Boolean).join(' · '),
          valeur: num(e.montant), champ: `comptes.${idxCompte}.cash.${idxCash}.montant` });
      });
    });
    const avecSupports = !cle && liquiditesEnLignes() !== 0;
    if (avecSupports) {
      for (const c of comptesOuverts()) {
        for (const l of lignesDe(c)) {
          if (l.classe !== 'liquidites') continue;
          lignes.push({ label: l.libelle || nomCompteV2(c),
            meta: [nomCompteV2(c), trad(LIBELLE_LIQUIDITES_EN_LIGNES)].filter(Boolean).join(' · '),
            valeur: num(l.valeur) });
        }
      }
    }
    return {
      titre: cle ? AFFECTATION_LABEL[cle] : BASES.liquidites.nom,
      sous: cle
        ? `${trad('Les comptes qui portent cette poche.')} ${
            lignes.length ? trad('Modifiable directement ici') : trad('Aucun compte ne la porte pour l’instant')}`
        : avecSupports
          ? trad('Les espèces se corrigent ici ; les supports monétaires suivent leur cours ou leur fiche.')
          : trad('Modifiable directement, ces montants se saisissent à la main'),
      total: lignes.reduce((s, l) => s + l.valeur, 0), lignes,
      vue: 'accounts', ancre: '', cta: trad('Ouvrir Actifs'),
    };
  },

  cashCible: (poche) => {
    const a = APERCUS.cash(poche);
    const base = rebalanceRows().base;
    return { ...a,
      totalNote: `${fmtPct(base ? a.total / base * 100 : 0, 1)} ${BASES.baseCibles.de}` };
  },

  objectif: () => {
    const g = objectiveStatus();
    const pj = objectiveProjection();
    const an = Store.state.meta.objectiveYear;
    const anCourante = new Date().getFullYear();
    const sansCible = !(num(g.obj) > 0);
    const p = progressionObjectif(g);
    const d = p.depart;
    /* UNE HIERARCHIE, ET ELLE SUIT LA QUESTION QU'ON VIENT POSER.
       En haut, ou l'on en est : le patrimoine, la cible, et la barre du depart a
       la cible, son pourcentage en petit. Au centre, la reponse : ce qui reste et
       le rythme qu'il faudrait tenir. Puis le point de depart, qui fonde la
       barre, avec de quoi le changer. Puis une extrapolation, dite comme telle.
       Les deux reglages ferment la fenetre, sous leur propre intitule : on les
       touche rarement, et poses au milieu ils se lisaient comme des resultats.

       Tout passe par `html` plutot que par `champs` et `lignes` : la fenetre
       generique pose ses champs AVANT ses lignes, donc au milieu du suivi. Les
       champs gardent leur `data-path`, et donc le regime differe de la fenetre :
       rien n'entre dans l'etat avant « Enregistrer ». */
    const avancement = p.etat === 'inconnu' ? ''
      : p.etat === 'atteinteAuDepart' ? trad('cible déjà atteinte au départ')
      : p.etat === 'atteint' ? trad('objectif atteint')
      : p.etat === 'enBaisse' ? `${fmtPct(p.pct, 1)} ${trad('du chemin : sous le point de départ')}`
      : `${fmtPct(p.pct, 1)} ${trad('du chemin parcouru')}`;
    const depasse = g.remaining >= 0;
    const reponse = sansCible ? '' : depasse ? `
      <div class="obj-reponse">
        <p><b class="obj-chiffre">+${fmtEUR0(g.remaining)}</b> ${trad('au-delà de ta cible')}</p>
      </div>` : `
      <div class="obj-reponse">
        <p><b class="obj-chiffre">${fmtEUR0(-g.remaining)}</b> ${trad('restants')}</p>
        <p>${pj.monthsLeft
          ? `<b>${fmtEUR0(pj.needed)} ${trad('/ mois')}</b> ${trad('jusqu’à fin {a}').replace('{a}', esc(an))}`
          : trad('à trouver avant la fin de l’année')}</p>
      </div>`;
    const departLigne = sansCible ? '' : `
      <div class="obj-depart">
        <span class="muted">${d
          ? `${trad('Point de départ')}${deuxPoints()} ${trad('{v} le {d}').replace('{v}', fmtEUR0(d.valeur)).replace('{d}', esc(fmtDate(d.date)))}`
          : trad('Point de départ à définir pour suivre l’avancement.')}</span>
        <button type="button" class="btn sm ghost" data-action="objectif-depart">${trad(d ? 'Changer' : 'Choisir')}</button>
      </div>`;
    const extrapolation = sansCible ? '' : !(pj.paceMonths > 0) ? `
      <p class="sous-titre-carte">${trad('Si ton rythme récent se poursuivait')}</p>
      <p class="hint obj-texte">${trad('Pas encore assez de relevés pour mesurer un rythme.')}</p>` : `
      <p class="sous-titre-carte">${trad('Si ton rythme récent se poursuivait')}</p>
      <p class="hint obj-texte">${trad('Sur {n} mois, entre {d} et {f}, ton patrimoine a varié de {r} par mois en moyenne.')
        .replace('{n}', pj.paceMois).replace('{d}', esc(fmtMonth(pj.paceDebut))).replace('{f}', esc(fmtMonth(pj.paceFin)))
        .replace('{r}', fmtSigned(pj.paceRate))}
        ${pj.monthsLeft ? trad(pj.atPace >= g.obj
          ? 'À ce rythme, il serait vers {v} fin {a}, au-dessus de ta cible.'
          : 'À ce rythme, il serait vers {v} fin {a}, en dessous de ta cible.')
          .replace('{v}', fmtEUR0(pj.atPace)).replace('{a}', esc(an)) : ''}
        ${trad('Cette variation mêle tes apports, les marchés et des événements ponctuels : c’est une extrapolation, pas une prévision.')}</p>`;
    const annees = Array.from({ length: 31 }, (_, i) => anCourante + i);
    const reglages = `
      <p class="sous-titre-carte">${trad(sansCible ? 'Fixer un objectif' : 'Modifier l’objectif')}</p>
      <div class="grid g-2 g-paire obj-reglages">
        <div class="field"><label>${trad('Montant visé ({dev})')}</label>
          <input type="number" step="500" inputmode="decimal" data-path="meta.objective"
                 value="${esc(String(getPath('meta.objective') ?? ''))}"></div>
        <div class="field"><label>${trad('Année')}</label>
          <select data-path="meta.objectiveYear" data-type="num">${annees.map(y =>
            `<option value="${y}" ${String(y) === String(an) ? 'selected' : ''}>${esc(`${trad('fin')} ${y}`)}</option>`).join('')}
          </select></div>
      </div>`;
    return {
      titre: `${trad('Objectif à fin')} ${an}`,
      sous: sansCible ? trad('aucune cible fixée') : pj.monthsLeft
        ? `${pj.monthsLeft} ${pj.monthsLeft > 1 ? trad('mois restants') : trad('mois restant')}` : trad('dernier mois'),
      total: g.total,
      totalNote: sansCible ? trad('ton patrimoine aujourd’hui') : `${trad('sur.objectif', 'sur')} ${fmtEUR0(g.obj)}`,
      html: `
      <div class="obj-suivi">
        ${sansCible || p.pct == null ? '' : `<div class="goal-bar"><div class="goal-fill" style="width:${p.barre.toFixed(2)}%"></div></div>`}
        ${sansCible || !avancement ? '' : `<p class="obj-avancement muted">${avancement}</p>`}
        ${reponse}
        ${departLigne}
      </div>
      ${extrapolation}
      ${reglages}`,
    };
  },

  horizon: () => {
    const s = projectionSettings();
    const p = capitalisation({ years: projHorizon });
    const j = p.points[p.points.length - 1];
    const aujourdhui = new Date();
    const date = new Date(aujourdhui.getFullYear() + projHorizon, aujourdhui.getMonth(), aujourdhui.getDate());
    const plat = num(p.plat);
    /* Toutes les poches qui capitalisent, rendues par `pochesProjection` :
       ecrire la somme ici a la main laissait une poche dehors des qu'une
       nouvelle arrivait, et la difference se retrouvait dans « ce que tu
       verses », qui annonçait des versements jamais faits. */
    const base = p.poches.placees;
    const verses = Math.max(0, j.contributed - base - plat);
    return {
      titre: `${trad('Projection à')} ${projHorizon} ${trad('ans')}`,
      sous: `${trad('au')} ${fmtDate(date.toISOString().slice(0, 10))}${trad(', même période de l’année qu’aujourd’hui')}`,
      total: j.total,
      totalNote: `${trad('dont')} ${fmtEUR0(j.gains)} ${trad('de rendement')}`,
      lignes: [
        { label: trad('Ce que tu as déjà'), meta: trad('aujourd’hui, hors biens détenus en direct et crédits'), valeur: base },
        /* Les deux lignes de la part plate, comme sur la carte : leur somme fait
           `plat`, et un pret qui ne finance aucun bien n'y est pas de l'immobilier. */
        ...(() => {
          const dp = partPlateDetail();
          const aDesBiens = num(dp.biens) > 0.005 || num(dp.dettesBiens) > 0.005;
          const biensNets = aDesBiens ? num(dp.biensNets) : 0;
          return [
            ...(Math.abs(biensNets) > 0.005 ? [{ label: trad('Ton immobilier net'), meta: A_PLAT, valeur: biensNets }] : []),
            ...(Math.abs(plat - biensNets) > 0.005 ? [{ label: aDesBiens ? trad('Tes autres crédits') : trad('Tes crédits'),
                                                        meta: A_PLAT, valeur: plat - biensNets }] : []),
          ];
        })(),
        { label: trad('Ce que tu verses'),
          meta: `${fmtEUR0(s.monthly)} × ${projHorizon * 12} ${trad('mois')}`, valeur: verses },
        { label: trad('Ce que le rendement ajoute'),
          meta: Math.abs(j.gains - num(j.gainsMarche)) > 0.005
            ? trad('selon tes hypothèses')
            : `${fmtPct(s.rate, 1)} ${trad('par an sur tes actifs de marché')}`,
          valeur: j.gains },
        { label: trad('Après inflation'), meta: `${fmtPct(s.inflation, 1)} ${trad('par an retirée, en euros d’aujourd’hui')}`, valeur: j.real },
      ],
      vue: 'objective', ancre: '', cta: trad('Voir la trajectoire'),
    };
  },

  bourse: () => {
    const lignes = Store.state.positions.map(p => ({
      label: p.name, meta: `${ACC[p.account]?.label || ''} · ${ASSET_CLASSES[assetClassDe(p)]}`,
      valeur: posValue(p), perf: posPerfPct(p),
    }));
    for (const a of accountsWhere(x => x.group === 'bourse' && !x.holdings)) {
      if (nowValue(a.id)) lignes.push({ label: a.label, meta: 'liquidités', valeur: nowValue(a.id) });
    }
    return {
      titre: trad('Bourse'), sous: `${Store.state.positions.length} ${trad('lignes de titres et liquidités')}`,
      total: nowByGroup().bourse, lignes: lignes.sort((a, b) => b.valeur - a.valeur),
      vue: 'positions', ancre: 'jour', cta: trad('Voir les marchés'),
    };
  },

  baseProjection: () => {
    const t = nowTotals();
    const s = projectionSettings();
    const q = pochesProjection(t);
    const tauxM = `${fmtPct(s.rate)} ${trad('par an')}`;
    const tauxA = num(s.rateAutres) ? `${fmtPct(s.rateAutres)} ${trad('par an')}` : A_PLAT;
    const tauxG = num(s.rateGaranti) ? `${fmtPct(s.rateGaranti, 1)} ${trad('par an')}` : A_PLAT;
    return {
      titre: trad('Ce que tu as déjà'),
      sous: trad('La base de la projection') + (num(t.immoDirect) ? trad(', ton immobilier à part') : ''),
      total: q.placees,
      totalNote: trad('chaque ligne porte le taux qui lui est appliqué'),
      /* Une ligne par poche que la projection distingue, et la liste doit les
         couvrir toutes : le total vient de `q.placees`, donc une poche oubliee
         ici se compte dans le total sans apparaitre nulle part : sans le
         capital garanti, la fenetre annoncerait 86 500 EUR pour quatre lignes
         qui en feraient 76 500. La somme des parts fait le total, ou elle ne
         dit rien. */
      /* Une ligne par poche de la projection, et la liste ne se recopie pas :
         chaque valeur vient de `pochesProjection`, celle-la meme que le moteur
         lit. Six lignes nommaient des classes — cryptomonnaies, non cote — que
         la projection ne distingue plus ; elles en font une, sous le nom de la
         poche et avec le taux qu'elle recoit vraiment. */
      lignes: [
        { label: trad('Actifs de marché'), meta: tauxM, valeur: q.marche },
        { label: trad('Capital garanti'), meta: tauxG, valeur: q.garanti },
        { label: trad('Autres actifs'), meta: tauxA, valeur: q.autres },
        { label: trad('Liquidités'), meta: A_PLAT, valeur: q.liquidites },
        { label: trad('Réservé à un projet'), meta: A_PLAT, valeur: q.projet },
      ].filter(l => Math.abs(l.valeur) > 0.005),
      vue: 'accounts', ancre: '', cta: trad('Voir les avoirs'),
    };
  },

  /* `quoi` suit les deux lignes de la carte : 'biens' ne rend que les biens en
     direct et les credits qui les financent, 'autres' toutes les autres dettes,
     et sans argument les deux. Chaque total est celui de la ligne cliquee. */
  immobilierNet: (quoi) => {
    const avecBiens = quoi !== 'autres', avecAutres = quoi !== 'biens';
    const lignes = [];
    for (const c of (Store.state.comptes || [])) {
      if (!avecBiens) break;
      if (c.statut === 'archive') continue;
      /* Les comptes que le perimetre financier ecarte, et eux seuls : c'est
         mot pour mot ce que `partPlate()` gele, donc les lignes font le total.
         Le filtre portait sur la CLASSE de la ligne, et cette fiche listait donc
         une SCPI sous « ton immobilier net » alors que la projection ne la gele
         plus : le total et ses parts ne se seraient plus accordes. Les biens de
         valeur restent ici avec l'immobilier — une montre comptee dans le total
         sans ligne en face etait deja le defaut qu'on repare. */
      if (!estHorsPerimetreFinancier(c)) continue;
      for (const l of (c.lignes || [])) {
        if (!num(l.valeur)) continue;
        lignes.push({ label: l.libelle || c.libelle, meta: trad('valeur estimée'),
                      valeur: num(l.valeur) });
      }
    }
    for (const e of (ETABS() || [])) {
      for (const d of (e.dettes || [])) {
        if (!num(d.montant)) continue;
        const c = compteFinanceParDette(d, e);
        const duBien = !!c && estHorsPerimetreFinancier(c);
        if (duBien ? !avecBiens : !avecAutres) continue;
        lignes.push({ label: d.libelle || trad('Crédit'),
                      meta: `${trad('capital restant dû')} · ${e.nom}${
                        !duBien && !classeFinanceeParDette(d, e) ? ` · ${trad('sans destination connue')}` : ''}`,
                      valeur: -num(d.montant) });
      }
    }
    const dp = partPlateDetail();
    const aDesBiens = num(dp.biens) > 0.005 || num(dp.dettesBiens) > 0.005;
    const plat = quoi === 'biens' ? num(dp.biensNets)
               : quoi === 'autres' ? -num(dp.autresDettes) : partPlate();
    const aImmo = num(nowTotals().immoDirect) > 0.005, aBiens = num(nowTotals().biens) > 0.005;
    const titreBiens = aImmo && aBiens ? trad('Ton immobilier et tes biens, nets')
                     : aBiens ? trad('Tes biens de valeur, nets') : trad('Ton immobilier net');
    const lesDeux = quoi == null && aDesBiens && num(dp.autresDettes) > 0.005;
    return {
      titre: quoi === 'autres' || !aDesBiens ? (aDesBiens ? trad('Tes autres crédits') : trad('Tes crédits'))
           : lesDeux ? trad('Ce que la projection porte à plat') : titreBiens,
      sous: lesDeux ? trad('tes biens en direct, leurs crédits et tes autres crédits')
                    : trad('Ce que la projection porte à plat'),
      total: plat,
      totalNote: trad('Aucun rendement ne lui est appliqué'),
      lignes,
      vue: 'accounts', ancre: '', cta: trad('Voir les avoirs'),
    };
  },
  /* Le detail de la reserve de securite, ouvert depuis sa carte de l'accueil :
     ce que la carte montrait sous sa jauge, sans rien recalculer. `runway()`
     porte les paliers, la reserve et le cout de la vie, et la carte comme la
     fenetre le lisent. */
  reserve: () => {
    const r = runway();
    const pk = poches();
    return {
      titre: trad('Réserve de sécurité'),
      sous: trad('si les revenus s\'arrêtaient'),
      total: r.reserve,
      totalNote: `${fmtMois(r.reserveMois)} ${trad('mois')} · ${trad('cible 3 à 6 mois')}`,
      html: `
        <p class="small muted" style="margin:0 0 12px">${trad('épargne de précaution + cash disponible')}</p>
        ${pk.projet > 0.005 ? `
        <p class="small muted" style="margin:0 0 12px">
          + ${fmtEUR0(pk.projet)} ${trad('réservés à un projet, disponibles si tu y touches.')}
          ${aide(trad('Ils ne comptent pas dans le coussin : la règle des 3 à 6 mois vise '
          + 'ce qui n’a pas encore d’emploi. Ils sont bien là, et ils figurent dans '
          + '« Disponible tout de suite » juste en dessous : c’est ce qui explique '
          + 'l’écart entre les deux montants.'))}
        </p>` : ''}
        <ul class="runway">${r.tiers.filter(x => x.value > 0).map(x => `
          <li class="rw-ligne${x.horsCumul ? ' rw-hors' : ''}">
            <div class="rw-haut"><span class="rw-lab">${esc(trad(x.label))}</span><b class="rw-val">${fmtEUR0(x.value)}</b></div>
            <div class="rw-bas"><span class="rw-note">${esc(trad(x.note))}</span>
              <span class="tag rw-mois">${x.horsCumul
                ? trad('hors réserve') : `${fmtMois(x.months)} ${trad('mois cumulés')}`}</span></div>
          </li>`).join('')}</ul>
        <p class="small muted" style="margin:12px 0 0">
          ${trad('Coût de la vie retenu :')} ${fmtEUR0(r.burn)} ${trad('/ mois (charges fixes + dépenses moyennes).')}
        </p>`,
    };
  },
  capaciteEpargne: () => {
    const rec = savingsReconciliation();
    return {
      titre: trad('Capacité d’épargne'),
      sous: trad('ce que ton budget laisse disponible chaque mois'),
      total: rec.investable,
      totalNote: trad('disponibles chaque mois'),
      html: `<table><tbody>
        <tr><td class="name">${trad('Revenus fixes')}</td><td class="muted"></td>
            <td><b>${fmtEUR(rec.income)}</b></td></tr>
        <tr><td class="name">${trad('− Charges fixes')}</td><td class="muted"></td>
            <td><b>−${fmtEUR(rec.fixed)}</b></td></tr>
        <tr><td class="name">${trad('− Dépenses moyennes')}</td><td class="muted"></td>
            <td><b>−${fmtEUR(rec.spend)}</b></td></tr>
      </tbody></table>
      ${rec.capitalRembourse > 0.005 ? `<p class="hint" style="margin:12px 0 0">
        ${trad('Le capital remboursé sur tes crédits')} (${fmtEUR0(rec.capitalRembourse)}
        ${trad('par mois')}) ${trad('augmente ton patrimoine, mais il n’est pas compté ici : il est déjà parti avec la mensualité, donc il n’est pas disponible à investir.')}</p>` : ''}`,
      vue: 'budget', ancre: '', cta: trad('Voir le Budget'),
    };
  },

  /* Cette fiche s'ouvre depuis Allocation, et de nulle part ailleurs : elle
     herite donc du perimetre de cette page. Sans cet heritage, la carte
     annoncait un montant hors immobilier et la fiche en rendait un autre, murs
     compris — le meme intitule, deux montants a un clic d'ecart.

     La note du haut prend la base du perimetre, pas le patrimoine entier : un
     pourcentage calcule sur une base plus large que la liste qu'il surmonte ne
     totalise pas cent, et c'est la faute que cette base de code traque depuis le
     debut. `baseAlloc().de` porte deja la forme grammaticale des deux cas. */

  /* Les lignes de cibles, tresorerie comprise quand elle est suivie. Cinq
     endroits lisaient `[...r.classes, r.cash]` en supposant `r.cash` toujours
     present : le jour ou la tresorerie a pu se retirer, la page tombait sur un
     `null.delta`. Un seul passage, donc un seul endroit ou se tromper. */
  portefeuilleBoursier: () => {
    const r = rebalanceRows();
    return {
      titre: trad('Comptes d’investissement'), sous: trad('Base de calcul du rééquilibrage'),
      total: r.base,
      lignes: lignesAvecTresorerie(r).map(c => ({
        label: c.label, meta: `${fmtPct(c.pct, 1)} · cible ${fmtPct(c.targetPct, 0)}`, valeur: c.value })),
      vue: 'rebalance', ancre: '', cta: trad('Voir les cibles'),
    };
  },
  ecartCible: () => {
    const r = rebalanceRows();
    return {
      titre: trad('Écarts à la cible'), sous: trad('Ce qu’il faudrait déployer (+) ou alléger (−)'),
      total: r.base, totalNote: trad('comptes d’investissement'),
      lignes: lignesAvecTresorerie(r).map(c => ({
        label: c.label, meta: `${fmtEUR0(c.value)} ${trad('pour')} ${fmtEUR0(c.targetVal)} ${trad('visés')}`, valeur: c.delta })),
      vue: 'rebalance', ancre: '', cta: trad('Ajuster'),
    };
  },

  depensesAnnee: () => {
    const an = budgetAnnee();
    const st = expenseYearStats(an);
    return {
      titre: `${trad('Dépenses')} ${an}`, sous: `${st.months} ${st.months > 1 ? trad('mois renseignés') : trad('mois renseigné')}`,
      total: st.total, totalNote: `${fmtEUR0(st.average)} ${trad('par mois en moyenne')}`,
      lignes: expenseSeries(an).filter(r => r.total).reverse()
        .map(r => ({ label: r.label, meta: r.note ? String(r.note).slice(0, 60) : '', valeur: r.total })),
      vue: 'budget', ancre: '', cta: trad('Voir le détail'),
    };
  },
  depensesCategories: () => {
    const an = budgetAnnee();
    const st = expenseYearStats(an);
    return {
      titre: trad('Moyenne mensuelle'), sous: `${trad('objectif')} ${fmtEUR0(budgetFrame().target)} ${trad('par mois')}`,
      total: st.average,
      totalNote: st.average > budgetFrame().target
        ? `${fmtEUR0(st.average - budgetFrame().target)} ${trad('au-dessus de l’objectif')}`
        : `${fmtEUR0(budgetFrame().target - st.average)} ${trad('sous l’objectif')}`,
      lignes: expenseByCategory(an).map(c => ({ label: c.label, meta: fmtPct(c.pct, 1), valeur: c.average })),
      vue: 'budget', ancre: '', cta: trad('Voir le détail'),
    };
  },

  chargesFixes: () => {
    const postes = (Store.state.budget.fixedCharges || [])
      /* `v` est l'equivalent MENSUEL de ce qui est debite — c'est le total du
         panneau, et il doit valoir celui de la carte qui l'ouvre. `facture`
         reste le montant tel qu'il est facture : c'est lui qu'on relit sur
         l'avis. */
      .map(c => ({ nom: c.label || 'Sans nom', v: chargeMensuelle(c),
                   periode: chargePeriode(c), facture: num(c.amount) }))
      .filter(x => x.v > 0)
      .sort((a, x) => x.v - a.v);
    const total = postes.reduce((s, x) => s + x.v, 0);
    return {
      titre: trad('Ce qui sort chaque mois'),
      sous: `${postes.length} ${postes.length > 1 ? trad('postes') : trad('poste')} · ${fmtEUR0(total * 12)} ${trad('sur douze mois')}`,
      total,
      totalNote: budgetFrame().fixedPct == null ? trad('aucun revenu déclaré')
        : `${fmtPct(budgetFrame().fixedPct, 1)} ${trad('de tes revenus')}`,
      /*         Le total a l'annee est en sous-titre, mais poste par poste il
         faudrait multiplier de tete, et c'est a cette echelle qu'on decide
         de garder un abonnement : 21 EUR par mois se lisent autrement a 252 EUR
         par an. Douze lignes de plus a l'ecran l'auraient dit en permanence pour
         un chiffre qu'on consulte une fois, d'ou la bulle.

         `data-aide` et rien d'autre : le survol, l'appui, le clavier et la
         fermeture au premier geste ailleurs y sont deja, et depuis que ces
         ecouteurs sont delegues ils atteignent l'interieur d'une fenetre. C'est
         ce qui rend cette demande gratuite.

         La periodicite s'y ajoute quand elle n'est pas mensuelle : la ligne
         affiche un montant ramene au mois, qu'on ne retrouve sur aucune facture,
         et la bulle est le seul endroit qui puisse rapprocher les deux. */
      html: postes.length ? `<div class="flow">${postes.map(x => `
        <div class="flow-row" tabindex="0" role="button" data-aide="${esc(
          `${x.nom} : ${fmtEUR0(x.v * 12)} ${trad('sur douze mois')}${x.periode === 'mois' ? ''
            : `, ${trad('facturée')} ${CHARGE_PERIODE_LABEL[x.periode]} ${fmtEUR0(x.facture)}`}`)}">
          <span class="flow-label">${esc(x.nom)}</span>
          <div class="flow-bar"><div style="width:${Math.max(1.5, total ? x.v / total * 100 : 0).toFixed(1)}%;
            background:var(--degrade-budget)"></div></div>
          <b class="flow-val">${fmtEUR0(x.v)}</b>
          <span class="flow-pct">${fmtPct(total ? x.v / total * 100 : 0, 1)}</span>
        </div>`).join('')}</div>
        <p class="small muted" style="margin:12px 0 0">${trad('Touche une ligne pour voir '
          + 'ce qu’elle coûte sur douze mois. Les parts se rapportent aux')}
          ${fmtEUR0(total)} ${trad('qui sortent chaque mois.')}</p>`
        : `<p class="empty" style="margin:0">${trad('Aucune charge fixe déclarée.')}</p>`,
      vue: 'budget', ancre: 'charges', cta: trad('Modifier les charges'),
    };
  },

  /* Le detail d'une vente.

     Ce que trois tuiles disaient pour toute la page — produit encaisse, prix de
     revient cede, taux de reussite — appartient a chaque vente : ce sont des
     faits de celle-la, pas des totaux d'ecran. Deux d'entre eux se relisaient
     deja en tete de page, ou la plus-value encaissee porte son pourcentage et son
     compte de ventes gagnantes.

     Le panneau porte aussi l'annulation, qui vivait au bout d'une ligne de
     tableau. Ici le geste a la place de dire ce qu'il emporte, et il n'est plus a
     portee de pouce de la lecture.

     `ventesRealisees` a disparu avec la tuile qui l'ouvrait : une fonction sans
     appelant est la moitie qu'on oublie en retirant un affichage. */
  vente: (i) => {
    const idx = Number(i);
    const v = (Store.state.sales || [])[idx];
    if (!v) return null;
    const dev = v.currency || 'EUR';
    const r = resultatVente(v);
    const pct = r.fiable && num(v.invested) ? r.montant / num(v.invested) * 100 : null;
    const coutConnu = v.invested != null && (r.fiable || v.declaree || (v.cession && r.raison !== 'prixDeRevient'));
    const depuis = v.account ? (ACC[v.account]?.label || '') : '';
    const vers = v.cashAccount ? (ACC[v.cashAccount]?.label || '') : '';
    return {
      titre: v.name || trad('Vente'),
      sous: [fmtDate(v.date), v.declaree ? trad('déclarée, pour mémoire') : '']
            .filter(Boolean).join(' · '),
      total: r.fiable ? r.montant : 0,
      totalTexte: r.fiable ? null : trad('Résultat non calculable'),
      totalNote: !r.fiable ? `${motifVente(r)}. ${trad('Pour le corriger, annule la vente puis ressaisis-la.')}`
        : pct == null ? trad('prix de revient non renseigné')
        : `${fmtSignedPct(pct)} ${trad('sur.investis', 'sur')} ${fmtEUR0(v.invested)} ${trad('investis')}`,
      html: `
        <dl class="kv">
          ${v.typeActif === 'bien' ? detailVenteBien(v, r) : `
          ${v.declaree ? '' : `
          <dt>${trad('Quantité vendue')}</dt><dd>${num(v.qty)}</dd>
          <dt>${trad('Prix de vente')}</dt><dd>${fmtCurEur(v.price, dev, v.fxSell)}</dd>
          <dt>${trad('Prix de revient unitaire')}</dt><dd>${!coutConnu
            ? trad('non renseigné') : fmtCurEur(v.buyPrice, dev, v.fxBuy)}</dd>`}
          <dt>${trad('Produit encaissé')}</dt><dd>${fmtEUR(num(v.gross))}</dd>
          <dt>${trad('Prix de revient vendu')}</dt><dd>${!coutConnu
            ? trad('non renseigné') : fmtEUR(num(v.invested))}</dd>
          <dt>${trad('Plus-value')}</dt>
            <dd class="${r.fiable ? cls(r.montant) : 'muted'}"><b>${r.fiable
              ? fmtSigned(r.montant) : trad('non calculable')}</b></dd>
          ${depuis ? `<dt>${trad('Ligne vendue sur')}</dt><dd>${esc(depuis)}</dd>` : ''}
          ${vers ? `<dt>${trad('Encaissé sur')}</dt><dd>${esc(vers)}</dd>` : ''}`}
          ${v.note ? `<dt>${trad('Note')}</dt><dd>${esc(v.note)}</dd>` : ''}
        </dl>
        <div class="row" style="margin-top:12px">
          <button class="btn sm" data-action="edit-sale" data-i="${idx}">${trad('Modifier')}</button>
          <button class="btn ghost sm" data-action="del-sale" data-i="${idx}">${
            v.declaree ? trad('Retirer du journal') : trad('Annuler cette vente')}</button>
        </div>`,
      vue: 'positions', ancre: 'ventes', cta: trad('Rester ici'),
    };
  },

  perfLatente: () => {
    const lat = latentPnl();
    return {
      titre: trad('Plus-value latente'),
      sous: `${lat.winners} ${trad('lignes en gain sur')} ${lat.avecBase}`,
      total: lat.pnl, totalNote: [lat.pct == null
        ? trad('prix de revient non renseigné')
        : `${fmtSignedPct(lat.pct)} ${trad('sur.investis', 'sur')} ${fmtEUR0(lat.invested)} ${trad('investis')}`,
        noteSansBase(lat)].filter(Boolean).join(', '),
      lignes: Store.state.positions
        .map(p => ({ label: p.name, meta: `${ACC[p.account]?.label || ''} · ${ASSET_CLASSES[assetClassDe(p)]}`,
                     valeur: posPerfEur(p), perf: posPerfPct(p) }))
        .sort(parGainDecroissant),
      vue: 'positions', ancre: 'titres', cta: trad('Voir les lignes'),
    };
  },
  releveMois: (arg) => {
    const i = +arg;
    const r = Store.state.monthly?.[i];
    if (!r) return null;
    const g = rowGroups(r);
    const total = rowTotal(r);
    const avant = Store.state.monthly.slice(0, i).filter(x => !rowIsEmpty(x)).pop();
    const dettes = num(r.dettes);
    const net = rowNet(r);
    const dlt = avant ? net - rowNet(avant) : 0;
    const variation = variationDuReleve(i);
    const poches = seriesUtiles([g]).filter(p => Math.abs(num(g[p.key])) > 0.005);
    const comptes = Object.entries(r.v || {})
      .map(([id, v]) => ({ id, v: num(v), a: ACC[id] }))
      .filter(x => Math.abs(x.v) > 0.005)
      .sort((x, y) => Math.abs(y.v) - Math.abs(x.v));
    return {
      titre: `${trad('Relevé de')} ${fmtMonth(r.date)}`,
      sous: avant
        ? `${fmtSigned(dlt)} ${trad('depuis')} ${fmtMonth(avant.date)}`
        : trad('le premier relevé de la série'),
      total: net,
      totalNote: dettes
        ? `${trad('avoirs')} ${fmtEUR0(total)} ${trad('moins')} ${fmtEUR0(dettes)} ${trad('de crédits')}`
        : trad('aucun crédit ce mois-là : net et brut se confondent'),
      html: `
        ${r.comment ? `<p class="hint" style="margin:0 0 12px">${esc(r.comment)}</p>` : ''}
        <table><tbody>${poches.map(p => `<tr>
          <td class="name">${esc(p.label)}</td>
          <td class="muted">${total ? fmtPct(num(g[p.key]) / total * 100, 0) : ''}</td>
          <td><b>${fmtEUR0(num(g[p.key]))}</b></td>
        </tr>`).join('')}${dettes ? `<tr>
          <td class="name">${trad('Crédits restants')}</td>
          <td class="muted"></td>
          <td><b>${fmtEUR0(-dettes)}</b></td>
        </tr>` : ''}</tbody></table>
        ${variation ? `
        <p class="hint" style="margin:14px 0 6px">${eliderDe(trad('Écarts depuis le relevé de {m}')
          .replace('{m}', esc(fmtMonth(variation.depuis))))}</p>
        ${listeVariation(variation, { avecTotal: false })}` : ''}
        ${comptes.length ? `
        <p class="hint" style="margin:14px 0 2px">${trad('Compte par compte')}</p>
        <table><tbody>${comptes.map(c => `<tr>
          <td class="name">${esc(c.a ? c.a.label : c.id)}${c.a && c.a.broker
            ? `<span class="sub">${esc(c.a.broker)}</span>` : ''}</td>
          <td class="muted"></td>
          <td><b>${fmtEUR0(c.v)}</b></td>
        </tr>`).join('')}</tbody></table>` : ''}
        ${r.clotureLe ? `
        <p class="small muted" style="margin:12px 0 0">${trad('Photo enregistrée le {d}')
          .replace('{d}', esc(fmtDate(r.clotureLe)))}</p>` : ''}
        <button class="btn pleine" style="margin-top:12px" type="button"
                data-action="edit-month" data-i="${i}">${trad('Modifier le relevé')}</button>`,
    };
  },

  moisObjectif: (sens) => {
    const an = budgetAnnee();
    const stats = expenseYearStats(an);
    const cible = budgetFrame().target;
    const sous = sens !== 'sur';
    const rows = sous ? stats.sousObjectif : stats.surObjectif;
    return {
      titre: `${sous ? trad('Mois sous l’objectif') : trad('Mois au-dessus de l’objectif')} · ${an}`,
      sous: `${trad('objectif')} ${fmtEUR0(cible)} ${trad('par mois')}`
        + (stats.moisEnCoursExclu ? ` · ${trad('le mois en cours, incomplet, est écarté')}` : ''),
      total: rows.reduce((s, r) => s + r.total, 0),
      totalNote: `${rows.length} ${trad('mois')}`,
      lignes: rows.slice().reverse().map(r => ({
        label: r.label,
        meta: [sous ? `${fmtEUR0(cible - r.total)} ${trad('de marge')}`
                    : `${fmtEUR0(r.total - cible)} ${trad('au-dessus')}`,
               r.note || ''].filter(Boolean).join(' · '),
        valeur: r.total })),
      vue: 'budget', ancre: '', cta: trad('Voir le détail'),
    };
  },

  repere: (sym) => {
    const l = REPERES_AFFICHES.find(x => x.symbole === sym);
    if (!l) return null;
    const dec = estVix(l) ? 1 : l.prix < 10 ? 4 : 2;
    const nb = v => moinsTypographique(new Intl.NumberFormat(locale(),
      { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v));
    const estIndice = String(l.symbole || '').startsWith('^');
    const unite = uniteRepere(l);
    const m = marketStatus(l);
    const delta = l.prix - l.veille;

    const ponts = [];
    if (sym === 'EURUSD=X') {
      const usd = Store.state.positions.filter(p => (p.currency || 'EUR') === 'USD')
        .reduce((s, p) => s + posValue(p), 0);
      if (usd > 0.005) ponts.push(['Tes lignes en dollars', usd,
        'leur valeur en euros bouge avec cette parité']);
    }
    if (sym === 'GC=F') {
      const or = Store.state.positions.filter(p => assetClassDe(p) === 'metaux')
        .reduce((s, p) => s + posValue(p), 0);
      if (or > 0.005) ponts.push(['Ta poche métaux', or, 'suit le cours de l’or']);
    }
    if (sym === 'BTC-USD') {
      const cr = num(nowTotals().crypto);
      if (cr > 0.005) ponts.push(['Ta poche crypto', cr, 'suit le marché des cryptomonnaies']);
    }

    return {
      titre: l.nom,
      sous: estVix(l) ? trad('Volatilité du S&P 500') : estIndice ? 'Indice boursier' : l.symbole,
      totalTexte: `${nb(l.prix)}${unite}`,
      /* Le niveau prend la place de l'etat de seance sous le nombre : c'est ce
         qu'on vient lire.

         TEXTE NU, et c'est un contrat : `noteApercu` passe par `escMontant`,
         qui echappe tout sauf le fragment de l'oeil masque. Une pastille d'aide
         posee ici s'imprimait donc en clair, balise comprise, sous le grand
         nombre. Le slot qui accepte du balisage est `html`, plus bas, et c'est
         la que l'aide vit. */
      totalNote: estVix(l) ? (niveauVix(l.prix) || '') : (m ? m.label : ''),
      html: `<dl class="kv">
        ${estVix(l) ? `<dt>${trad('Ce qu’il mesure')}${aide(trad(AIDE_VIX))}</dt>
          <dd class="phrase">${trad('Volatilité attendue, pas une performance')}</dd>` : ''}
        <dt>${trad('Variation du jour')}</dt>
          <dd class="${l.pct == null ? 'muted' : cls(l.pct)}">${l.pct == null
            ? `${trad('hors séance')}${l.quoteTime ? ` · ${trad('cours')} ${esc(fmtCoursQuand(l.quoteTime))}` : ''}`
            : `${fmtSignedPct(l.pct, 2)} · ${delta >= 0 ? '+' : '−'}${nb(Math.abs(delta))}${unite}`}</dd>
        <dt>${trad('Clôture précédente')}</dt><dd>${nb(l.veille)}${unite}</dd>
        ${m ? `<dt>${trad('Séance')}</dt><dd>${glypheSeance(m)} ${esc(m.label)}</dd>` : ''}
        ${ponts.map(([t, v, note]) => `
          <dt>${esc(t)}<span class="sub">${esc(note)}</span></dt><dd><b>${fmtEUR(v)}</b></dd>`).join('')}
      </dl>`,
      vue: 'positions', ancre: '', cta: trad('Voir les marchés'),
    };
  },

  portefeuille: () => {
    const pnl = portfolioPnl();
    return {
      titre: trad('Valeur du portefeuille'), sous: `${Store.state.positions.length} ${trad('lignes de titres')}`,
      total: pnl.value, totalNote: pnl.pct == null
        ? trad('prix de revient non renseigné')
        : `${fmtSignedPct(pnl.pct)} ${trad('sur le prix de revient')}`,
      lignes: Store.state.positions
        .map(p => ({ label: p.name, meta: `${ACC[p.account]?.label || ''} · ${num(p.qty)} × ${fmtCur(p.price, p.currency)}`,
                     valeur: posValue(p), perf: posPerfPct(p) }))
        .sort((a, b) => b.valeur - a.valeur),
      vue: 'positions', ancre: 'titres', cta: trad('Voir les lignes'),
    };
  },

  investiTitres: () => ({
    titre: trad('Montant investi'), sous: trad('Ce que tes lignes t’ont coûté'),
    total: portfolioPnl().invested,
    totalNote: `${trad('pour')} ${fmtEUR0(portfolioPnl().value)} ${trad('de valeur actuelle')}`,
    lignes: Store.state.positions
      .map(p => ({ label: p.name,
                   meta: posInvested(p)
                     ? `${num(p.qty)} × ${fmtCur(p.buyPrice, p.currency)} ${trad('à l’achat')}`
                     : trad('prix de revient manquant'),
                   valeur: posInvested(p) || null }))
      .sort(parGainDecroissant),
    vue: 'positions', ancre: 'titres', cta: trad('Voir les lignes'),
  }),

  pnlLatent: () => {
    const pnl = portfolioPnl();
    const j = dayPerformance();
    return {
      titre: trad('Plus-value latente'),
      sous: [pnl.pct == null ? trad('prix de revient non renseigné') : fmtSignedPct(pnl.pct),
             j.lignes.length ? `${fmtSigned(j.eur)} ${trad('aujourd’hui')}` : trad('pas de cours du jour')].join(' · '),
      total: pnl.pnl,
      totalNote: [`${trad('sur.investis', 'sur')} ${fmtEUR0(pnl.invested)} ${trad('investis')}`,
        trad('avant impôt'),
        noteSansBase(pnl)].filter(Boolean).join(', '),
      lignes: Store.state.positions
        .map(p => ({ label: p.name, meta: `${ACC[p.account]?.label || ''} · ${ASSET_CLASSES[assetClassDe(p)]}`,
                     valeur: posPerfEur(p), perf: posPerfPct(p) }))
        .sort(parGainDecroissant),
      vue: 'positions', ancre: '', cta: trad('Voir tes lignes'),
    };
  },

  /* Les credits, montants modifiables.

     Le meme panneau que les liquidites, pour la meme raison : relever ses soldes
     est une passe, pas une fiche par fiche. On ouvre, on recopie ce que disent la
     banque et le courtier, on enregistre.

     Il ne remplace pas la fenetre d'un credit — celle-la porte le taux, la
     mensualite, le preteur, tout ce qui ne change qu'une fois. Ici il n'y a que le
     chiffre qui vieillit. Un seul champ, deux portes, comme partout ailleurs.

     Et l'enregistrement pose la date de verification sur chaque credit : appuyer
     sur « Enregistrer » ici, c'est precisement affirmer les avoir regardes, ce qui
     remet le rappel des trois mois a zero. Voir `apercu-enregistrer`. */
  credits: () => {
    const cr = creditsEnCours();
    const etabs = ETABS();
    return {
      titre: trad('Crédits en cours'),
      sous: cr.lignes.length
        ? `${cr.lignes.length} ${cr.lignes.length > 1 ? trad('crédits') : trad('crédit')} · ${trad('modifiable ici même')}`
        : trad('aucun crédit'),
      totalTexte: `−${fmtEUR(cr.reste)}`,
      total: cr.reste,
      totalNote: `${trad('à retrancher de')} ${fmtEUR0(patrimoine().brut)} ${trad('d’avoirs')}`,
      lignes: cr.lignes.map(c => ({
        label: c.libelle,
        ouvre: { action: 'editer-credit', donnees: { etab: c.etabId, i: c.index } },
        meta: [c.etabNom, c.preteur, c.taux ? `${fmtNombre(c.taux)} % ${trad('l’an')}` : '',
               c.mensualite ? `${fmtEUR0(c.mensualite)} ${trad('par mois')}` : '',
               c.fin ? `${trad('soldé')} ${fmtMoisAn(c.fin.finLe)}` : '',
               c.fin && c.depuisProjection ? trad('fin calculée sur le solde estimé d’aujourd’hui') : '']
              .filter(Boolean).join(' · '),
        champ: `etabs.${etabs.findIndex(e => e.id === c.etabId)}.dettes.${c.index}.montant`,
        valeur: c.reste,
      })),
    };
  },

  jourTitres: () => {
    const j = dayPerformance();
    return {
      titre: trad('Aujourd’hui'),
      sous: j.lignes.length
        ? [`${j.hausse} ${trad('en hausse')}`, `${j.baisse} ${trad('en baisse')}`,
           j.sansDonnee ? `${j.sansDonnee} ${trad('sans cours de veille')}` : '',
           j.horsSeance ? `${j.horsSeance} ${trad('sans cours du jour')}` : '',
           j.asOfMarche ? `${trad('cours')} ${fmtCoursQuand(j.asOfMarche)}` : ''].filter(Boolean).join(' · ')
        : trad('pas de clôture de veille en mémoire'),
      total: j.eur,
      totalNote: j.toutHorsSeance
        ? trad('aucune de tes lignes n’a coté depuis minuit')
        : `${fmtSignedPct(j.pct)} ${trad('sur la clôture précédente')}`,
      lignes: j.lignes.map(l => ({
        label: l.name,
        meta: [l.exchange || l.symbol, l.market?.label,
               l.horsSeance ? (l.quoteTime ? `${trad('cours')} ${fmtCoursQuand(l.quoteTime)}`
                                           : trad('pas coté aujourd’hui')) : ''].filter(Boolean).join(' · '),
        valeur: l.eur, perf: l.pct,
      })),
      vue: 'positions', ancre: 'jour', cta: trad('Voir la séance'),
    };
  },

  cashInvestir: () => ({
    titre: BASES.cashPlacer.nom, sous: trad('Liquidités posées chez tes courtiers'),
    total: stockTotals().cashToInvest,
    totalNote: `${fmtPct(poidsPortefeuille(stockTotals().cashToInvest))} ${trad('du portefeuille')}`,
    lignes: entreesInvestir().map(({ compte, idxCompte, idxCash }) => ({
      label: nomCompteV2(compte),
      meta: [nomEtabDe(compte), trad(typeCompte(compte.type).label)].filter(Boolean).join(' · '),
      champ: `comptes.${idxCompte}.cash.${idxCash}.montant`,
    })),
    vue: 'accounts', ancre: '', cta: trad('Voir les comptes'),
  }),

  /* Les lignes suivent la CLASSE du total, pas le groupe d'ecran : le groupe
     `pe` rassemble aussi l'immobilier et les biens de valeur, et la fenetre
     listait donc des comptes pour bien plus que son total — un studio a
     120 000 EUR sous un titre qui annonce le non cote. La valeur par compte
     est celle de ses lignes non cotees seulement, et la somme des parts
     refait le total. */
  pe: () => {
    const nc = latentNonCote();
    const lignes = nc.lignes.filter(l => l.classe === 'nonCote');
    const value = lignes.reduce((s, l) => s + l.value, 0);
    const invested = lignes.reduce((s, l) => s + l.invested, 0);
    const pnl = value - invested;
    const vieilles = lignes.filter(l => l.vieille).length;
    return {
      titre: trad(CLASSES_ACTIFS.nonCote),
      sous: [trad('valeurs que tu déclares, pas des cours'),
             vieilles ? `${vieilles} ${vieilles > 1 ? trad('à revoir') : trad('à revoir')}`
                      : trad('pas mobilisables à court terme')].join(' · '),
      total: nowByGroup().pe,
      totalNote: invested > 0
        ? `${fmtEUR0(invested)} ${trad('investis')} · ${trad('écart')} ${fmtSigned(pnl)} (${
            fmtSignedPct(pnl / invested * 100, 1)})`
        : trad('prix de revient non renseigné'),
      lignes: lignes.map(l => ({
        label: l.nom,
        meta: [sousNom(l.nom, nomCompteV2(l.compte), nomEtabDe(l.compte)),
               l.estimeLe ? `${trad('estimé')} ${fmtDate(l.estimeLe)}`
                          : trad('jamais estimé')].filter(Boolean).join(' · '),
        valeur: l.value,
        perf: l.invested > 0 ? l.pct : null,
        route: `#/compte/${encodeURIComponent(l.compteId)}`,
      })),
      vue: 'accounts', ancre: '', cta: trad('Ouvrir Actifs'),
    };
  },

  investi: () => ({
    titre: BASES.place.nom,
    sous: trad('Réparti par enveloppe'),
    total: nowTotals().invested,
    lignes: allocationByAccount().filter(r => r.value)
      .map(r => ({ label: r.label, meta: fmtPct(r.pct, 1), valeur: r.value })),
    vue: 'allocation', ancre: 'actifs', cta: trad('Voir l\'allocation'),
  }),
};

let apercuOuvert = null;
let apercuArg = null;

partieChargee('assets/app-10-formulaire-generique.js');
