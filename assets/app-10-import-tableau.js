/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */

const MESSAGES_IMPORT = {
  xls: 'Ce fichier est un ancien classeur .xls, ou un classeur protégé par un mot de passe. Enregistre-le en .xlsx ou en CSV depuis ton tableur, puis reprends-le ici.',
  'zip-chiffre': 'Ce classeur est chiffré : enregistre-le sans mot de passe, puis reprends-le ici.',
  zip64: 'Ce classeur est trop volumineux pour être lu ici.',
  'zip-methode': 'Ce classeur utilise une compression que Longward ne lit pas. Enregistre-le en CSV.',
  'zip-incomplet': 'Ce fichier est incomplet ou abîmé : il ne se lit pas.',
  'xlsx-illisible': 'Ce classeur ne se lit pas. Enregistre-le en CSV depuis ton tableur.',
  'trop-gros': 'Ce fichier est trop volumineux pour être lu ici.',
  vide: 'Ce fichier ne contient aucun tableau.',
};

const EXEMPLE_OPERATIONS = [
  ['03/10/2026', 'CB BOULANGERIE', -4.2],
  ['05/10/2026', 'PRLV ABONNEMENT MOBILE', -19.99],
  ['28/10/2026', 'VIR SALAIRE', 2000],
];

function importerTableau(cible, fichierDonne = null) {
  return new Promise(resolve => {
    const m = $('#modal');
    apercuOuvert = null;
    const depenses = cible === 'depenses';
    const etat = { feuilles: null, feuille: 0, nomFichier: '' };
    let ouverte = true;
    const fermer = v => {
      if (!ouverte) return;
      ouverte = false;
      masquerModal(m);
      $('#modalClose').onclick = null;
      resolve(v);
    };
    $('#modalClose').onclick = () => fermer(null);
    $('#modalTitle').textContent = depenses ? trad('Importer des dépenses') : trad('Importer des relevés');
    $('#modalSub').textContent = trad('Le fichier se lit sur cet appareil et n’est envoyé nulle part ; les montants importés s’enregistrent ensuite comme tes saisies.');

    const etapeFichier = (erreur = '') => {
      $('#modalBody').innerHTML = `
        <p style="margin:0 0 12px">${depenses
          ? trad('L’export de ta banque, en Excel (.xlsx) ou en CSV : une ligne par opération, avec sa date, son libellé et son montant. Ou ton propre tableau de suivi : un mois par ligne, une colonne par catégorie.')
          : trad('Ton tableau de suivi, en Excel (.xlsx) ou en CSV : un mois par ligne, une colonne par compte. Les mois en colonnes se lisent aussi, et la feuille « Relevés mensuels » de l’export Longward s’importe telle quelle.')}</p>
        <input type="file" id="impFichier" class="fichier-cache"
               accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
        ${depenses ? `<p class="hint" style="margin:12px 0 4px">${trad('Par exemple, trois opérations d’un export :')}</p>
        <div class="imp-exemple">${EXEMPLE_OPERATIONS.map(([d, l, m]) => `
          <span>${d}</span><span>${esc(trad(l))}</span><b>${m < 0 ? '−' : '+'}${
            Math.abs(m).toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>`).join('')}
        </div>
        <p class="hint" style="margin:4px 0 0">${trad('Dans cet exemple, les dépenses sont négatives ; ta banque peut les écrire en positif, le sens se choisit à l’étape suivante. Une entrée d’argent, comme le salaire, ne s’importe pas.')}</p>` : ''}
        <p class="hint" style="margin:12px 0 8px">${trad('Pas sûr du format ? Télécharge un modèle fait de tes colonnes, remplis-le, puis choisis-le ici :')}</p>
        <div class="row" style="gap:8px">${depenses ? `
          <button type="button" class="btn sm ghost" id="impModeleOps">${icone('exporter')} ${trad('Opérations de banque')}</button>
          <button type="button" class="btn sm ghost" id="impModeleMois">${icone('exporter')} ${trad('Par mois et par catégorie')}</button>` : `
          <button type="button" class="btn sm ghost" id="impModeleRel">${icone('exporter')} ${trad('Télécharger un modèle')}</button>`}
        </div>
        ${erreur ? `<p class="note" style="margin:12px 0 0">⚠ <span>${esc(erreur)}</span></p>` : ''}`;
      $('#modalFoot').innerHTML = `<label class="btn" for="impFichier">${trad('Choisir un fichier')}</label>`;
      $('#impFichier').onchange = () => { const f = $('#impFichier').files[0]; if (f) lire(f); };
      const modele = (id, nom, feuilles) => { const b = $(id); if (b) b.onclick = () => Xlsx.save(nom, feuilles()); };
      modele('#impModeleOps', trad('longward-modele-operations.xlsx'), () => modeleOperations());
      modele('#impModeleMois', trad('longward-modele-depenses-par-mois.xlsx'),
        () => modeleDepensesParMois(expenseCategories(), todayISO().slice(0, 4)));
      modele('#impModeleRel', trad('longward-modele-releves.xlsx'), () => modeleReleves(ACCOUNTS, todayISO(),
        num(patrimoine().dettes) > 0 || (Store.state.monthly || []).some(r => num(r.dettes) > 0)));
    };
    const lire = async f => {
      try {
        if (f.size > IMPORT_LIMITES.fichier) throw new ErreurImport('trop-gros');
        const feuilles = (await lireFichierTableau(f.name, await f.arrayBuffer()))
          .filter(x => x.grille.some(l => l.some(c => c && c.t !== 'vide')));
        if (!feuilles.length) throw new ErreurImport('vide');
        etat.feuilles = feuilles;
        etat.nomFichier = f.name;
        const voulue = depenses ? /^d[eé]penses$/i : /^rel[eé]ves? mensuels$/i;
        const i = feuilles.findIndex(x => voulue.test(x.nom.trim()));
        etat.feuille = i >= 0 ? i : 0;
        nouvelleFeuille();
      } catch (e) {
        etapeFichier(trad(MESSAGES_IMPORT[e && e.code] || 'Ce fichier ne se lit pas.'));
      }
    };

    const nouvelleFeuille = () => {
      let grille = etat.feuilles[etat.feuille].grille;
      if (!depenses) grille = orienterMoisEnLignes(grille).grille;
      const d = detecterEntete(grille);
      etat.grille = grille;
      etat.debut = d + 1;
      etat.entete = grille[d] || [];
      etat.lignes = grille.slice(d + 1);
      etat.ordre = null;
      etat.ecarteesAcceptees = false;
      etat.doublons = {};
      etat.remplacer = false;
      etat.aVenir = false;
      etat.choix = null;
      etat.confirmes = new Set();
      etat.decisions = {};
      if (depenses) {
        const cats = expenseCategories();
        etat.forme = devinerFormeDepenses(etat.entete, etat.lignes, cats);
        etat.col = devinerColonnesOperations(etat.entete, etat.lignes);
        etat.deuxColonnes = etat.col.debit >= 0 && etat.col.credit >= 0;
        etat.sens = etat.col.montant >= 0 ? sensMajoritaire(etat.lignes, etat.col.montant) : 'negatif';
        const mo = devinerColonnesMois(etat.entete, etat.lignes, cats);
        etat.colMois = mo.date;
        etat.cibles = mo.colonnes.map(c => c || IGNORER);
        if (etat.colMois >= 0) etat.cibles[etat.colMois] = null;
      } else {
        etat.cibles = devinerColonnesReleves(etat.entete, etat.lignes, ACCOUNTS,
          { ignorer: SERIES_PATRIMOINE().map(s => s.label) });
      }
      etapeColonnes();
    };
    const nomColonne = i => {
      const c = etat.entete[i];
      return c && c.t !== 'vide' ? String(c.v) : `${trad('Colonne')} ${i + 1}`;
    };
    const indices = () => {
      const n = Math.max(etat.entete.length, ...etat.lignes.slice(0, 20).map(l => l.length));
      return Array.from({ length: n }, (_, i) => i);
    };
    const exemples = i => etat.lignes.slice(0, 3).map(l => l[i]).filter(c => c && c.t !== 'vide')
      .map(c => String(c.v)).join(' · ');
    const optionsColonnes = (valeur, vide = '') => `${vide ? `<option value="-1">${esc(vide)}</option>` : ''}${
      indices().map(i => `<option value="${i}"${i === valeur ? ' selected' : ''}>${esc(nomColonne(i))}</option>`).join('')}`;
    const colonneDate = () => (depenses ? (etat.forme === 'operations' ? etat.col.date : etat.colMois)
      : etat.cibles.indexOf('date'));
    const ordreInfo = () => {
      const i = colonneDate();
      return i >= 0 ? ordreAChoisir(etat.lignes.map(l => l[i])) : { ordre: 'jm', aDemander: false };
    };
    const ordreEffectif = () => etat.ordre || ordreInfo().ordre || (ordreInfo().aDemander ? null : 'jm');

    const blocagesColonnes = () => {
      const b = [];
      if (ordreInfo().aDemander && !etat.ordre) b.push(trad('Indique comment se lisent les dates.'));
      if (depenses && etat.forme === 'operations') {
        if (etat.col.date < 0) b.push(trad('Choisis la colonne des dates.'));
        if (etat.deuxColonnes && etat.col.debit >= 0 && etat.col.debit === etat.col.credit) {
          b.push(trad('Le débit et le crédit viennent de la même colonne : choisis-en deux différentes.'));
        }
        if (etat.deuxColonnes ? (etat.col.debit < 0 && etat.col.credit < 0) : etat.col.montant < 0) {
          b.push(trad('Choisis la colonne des montants.'));
        }
      } else if (depenses) {
        for (const x of blocagesColonnesMois(etat.cibles, etat.colMois)) {
          b.push(x.code === 'sans-date' ? trad('Choisis la colonne des mois.')
            : trad('Deux colonnes vont vers la catégorie {c} : garde-en une.').replace('{c}', guill(x.categorie)));
        }
        if (!etat.cibles.some(c => c && c !== IGNORER)) b.push(trad('Associe au moins une colonne à une catégorie.'));
      } else {
        for (const x of blocagesColonnesReleves(etat.entete, etat.cibles)) {
          b.push(x.code === 'sans-date' ? trad('Choisis la colonne des mois.')
            : x.code === 'compte-double' ? trad('Deux colonnes vont vers le compte {c} : garde-en une.')
              .replace('{c}', guill((ACC[x.compte] || {}).label || x.compte))
            : trad('Un total de crédits et ses parts vont ensemble vers les crédits du mois : garde le total OU ses parts.'));
        }
        if (etat.cibles.some(c => c === '')) b.push(trad('Certaines colonnes de montants restent à associer : choisis un compte, ou Ignorer.'));
      }
      return b;
    };

    const etapeColonnes = () => {
      const feuilles = etat.feuilles.length > 1 ? `
        <div class="field"><label for="impFeuille">${trad('Feuille')}</label>
          <select id="impFeuille">${etat.feuilles.map((f, i) => `<option value="${i}"${i === etat.feuille ? ' selected' : ''}>${esc(f.nom)}</option>`).join('')}</select></div>` : '';
      const info = ordreInfo();
      const ordre = info.aDemander || etat.ordre ? `
        <div class="field"><label for="impOrdre">${trad('Les dates se lisent')}</label>
          <select id="impOrdre">
            <option value=""${!etat.ordre ? ' selected' : ''}>${trad('À choisir')}</option>
            <option value="jm"${etat.ordre === 'jm' ? ' selected' : ''}>${trad('03/04 = 3 avril')}</option>
            <option value="mj"${etat.ordre === 'mj' ? ' selected' : ''}>${trad('03/04 = 4 mars')}</option>
          </select></div>` : '';
      let corps = '';
      if (depenses) {
        corps += `<div class="field"><label for="impForme">${trad('Ce fichier contient')}</label>
          <select id="impForme">
            <option value="operations"${etat.forme === 'operations' ? ' selected' : ''}>${trad('Des opérations de banque')}</option>
            <option value="mois"${etat.forme === 'mois' ? ' selected' : ''}>${trad('Un tableau par mois et par catégorie')}</option>
          </select></div>`;
        if (etat.forme === 'operations') {
          const c = etat.col;
          corps += `
            <div class="field"><label for="impColDate">${trad('Date')}</label><select id="impColDate">${optionsColonnes(c.date, trad('À choisir'))}</select></div>
            <div class="field"><label for="impColLib">${trad('Libellé')}</label><select id="impColLib">${optionsColonnes(c.libelle, trad('Aucun'))}</select></div>
            <div class="field"><label for="impDeux">${trad('Montants')}</label>
              <select id="impDeux">
                <option value="0"${!etat.deuxColonnes ? ' selected' : ''}>${trad('Une colonne')}</option>
                <option value="1"${etat.deuxColonnes ? ' selected' : ''}>${trad('Deux colonnes, débit et crédit')}</option>
              </select></div>
            ${etat.deuxColonnes ? `
            <div class="field"><label for="impColDebit">${trad('Débit')}</label><select id="impColDebit">${optionsColonnes(c.debit, trad('À choisir'))}</select></div>
            <div class="field"><label for="impColCredit">${trad('Crédit')}</label><select id="impColCredit">${optionsColonnes(c.credit, trad('Aucun'))}</select></div>` : `
            <div class="field"><label for="impColMontant">${trad('Montant')}</label><select id="impColMontant">${optionsColonnes(c.montant, trad('À choisir'))}</select></div>
            <div class="field"><label for="impSens">${trad('Dans cette colonne, tes dépenses sont')}</label>
              <select id="impSens">
                <option value="negatif"${etat.sens === 'negatif' ? ' selected' : ''}>${trad('Négatives (−12,50)')}</option>
                <option value="positif"${etat.sens === 'positif' ? ' selected' : ''}>${trad('Positives (12,50)')}</option>
              </select></div>`}
            <div class="field"><label for="impColCat">${trad('Catégorie de la banque')}</label><select id="impColCat">${optionsColonnes(c.categorie, trad('Aucune'))}</select></div>`;
        } else {
          corps += `<div class="field"><label for="impColMois">${trad('Mois')}</label><select id="impColMois">${optionsColonnes(etat.colMois, trad('À choisir'))}</select></div>`
            + listeCibles(expenseCategories().map(c => ({ v: c, l: c })));
        }
      } else {
        const ouverts = ACCOUNTS.filter(a => !a.legacy), clos = ACCOUNTS.filter(a => a.legacy);
        corps += listeCibles([
          { v: 'date', l: trad('Mois') },
          ...ouverts.map(a => ({ v: `compte:${a.id}`, l: a.broker ? `${a.label} · ${a.broker}` : a.label })),
          ...clos.map(a => ({ v: `compte:${a.id}`, l: `${a.label} (${trad('clôturé')})` })),
          { v: 'dettes', l: trad('Crédits du mois') },
        ]);
      }
      const blocages = blocagesColonnes();
      $('#modalBody').innerHTML = `
        <p class="hint" style="margin:0 0 8px">${esc(etat.nomFichier)} · ${etat.lignes.length > 1
          ? trad('{n} lignes lues').replace('{n}', etat.lignes.length) : trad('Une ligne lue')}</p>
        ${feuilles}${ordre}${corps}
        ${blocages.length ? `<div class="note" style="margin:12px 0 0">ⓘ <span>${blocages.map(esc).join('<br>')}</span></div>` : ''}`;
      $('#modalFoot').innerHTML = `<button class="btn" id="impSuite" type="button"${blocages.length ? ' disabled' : ''}>${trad('Continuer')}</button>
        <button class="btn ghost" id="impRetour" type="button">${trad('Retour')}</button>`;
      $('#impRetour').onclick = () => etapeFichier();
      $('#impSuite').onclick = () => { if (!blocagesColonnes().length) etapeVerification(); };
      const lier = (id, f) => { const el = $(id); if (el) el.onchange = () => { f(el.value); etapeColonnes(); }; };
      lier('#impFeuille', v => { etat.feuille = +v; nouvelleFeuille(); });
      lier('#impOrdre', v => { etat.ordre = v || null; });
      lier('#impForme', v => { etat.forme = v; });
      lier('#impColDate', v => { etat.col.date = +v; etat.ordre = null; });
      lier('#impColLib', v => { etat.col.libelle = +v; });
      lier('#impDeux', v => {
        etat.deuxColonnes = v === '1';
        if (etat.deuxColonnes) { etat.col.debit = etat.col.debit >= 0 ? etat.col.debit : etat.col.montant; etat.col.montant = -1; }
        else { etat.col.montant = etat.col.montant >= 0 ? etat.col.montant : etat.col.debit; etat.col.debit = -1; etat.col.credit = -1; }
      });
      lier('#impColDebit', v => { etat.col.debit = +v; });
      lier('#impColCredit', v => { etat.col.credit = +v; });
      lier('#impColMontant', v => { etat.col.montant = +v; etat.sens = +v >= 0 ? sensMajoritaire(etat.lignes, +v) : etat.sens; });
      lier('#impSens', v => { etat.sens = v; });
      lier('#impColCat', v => { etat.col.categorie = +v; });
      lier('#impColMois', v => {
        if (etat.colMois >= 0) etat.cibles[etat.colMois] = IGNORER;
        etat.colMois = +v; etat.ordre = null;
        if (etat.colMois >= 0) etat.cibles[etat.colMois] = null;
      });
      for (const s of $$('#modalBody [data-cible-col]')) {
        s.onchange = () => {
          const i = +s.dataset.cibleCol, v = s.value;
          if (depenses) etat.cibles[i] = v;
          else {
            if (v === 'date') etat.cibles = etat.cibles.map(c => (c === 'date' ? IGNORER : c));
            etat.cibles[i] = v.startsWith('compte:') ? { compte: v.slice(7) } : v;
            etat.ordre = null;
          }
          etapeColonnes();
        };
      }
    };
    const listeCibles = options => `
      <div class="imp-colonnes">${indices().map(i => {
        if (depenses && i === etat.colMois) return '';
        const c = etat.cibles[i];
        const v = c && typeof c === 'object' ? `compte:${c.compte}` : (c ?? IGNORER);
        return `<div class="imp-colonne">
          <span class="imp-colonne-nom"><b>${esc(nomColonne(i))}</b><span class="sub">${esc(exemples(i))}</span></span>
          <select data-cible-col="${i}" aria-label="${esc(nomColonne(i))}">
            ${v === '' ? `<option value="" selected>${trad('À choisir')}</option>` : ''}
            ${options.map(o => `<option value="${esc(o.v)}"${o.v === v ? ' selected' : ''}>${esc(o.l)}</option>`).join('')}
            <option value="${IGNORER}"${v === IGNORER ? ' selected' : ''}>${trad('Ignorer')}</option>
          </select></div>`;
      }).join('')}</div>`;

    const RAISONS = {
      date: 'date illisible', montant: 'montant illisible', pied: 'ligne de total ou de solde',
      vide: 'sans montant', zero: 'montant nul', 'debit-credit': 'débit et crédit remplis ensemble',
    };
    const listeEcartees = ecartees => {
      if (!ecartees.length) return '';
      const parRaison = {};
      for (const e of ecartees) (parRaison[e.raison] = parRaison[e.raison] || []).push(e);
      return `<p class="hint" style="margin:12px 0 0">${trad('Lignes écartées')} : ${Object.entries(parRaison)
        .map(([r, ls]) => `${ls.length} ${trad(RAISONS[r] || r)} (${trad('ligne')} ${ls.slice(0, 4).map(e => e.n + 1).join(', ')}${ls.length > 4 ? '…' : ''})`)
        .join(' · ')}</p>`;
    };
    const caseEcartees = ecartees => {
      const n = ecartees.filter(e => RAISONS_A_DECIDER.includes(e.raison)).length;
      return n ? `<label class="small row" style="gap:6px;margin-top:8px">
        <input type="checkbox" id="impEcarter" style="width:auto"${etat.ecarteesAcceptees ? ' checked' : ''}>
        ${n > 1 ? trad('Écarter ces {n} lignes à vérifier').replace('{n}', n)
                : trad('Écarter cette ligne à vérifier')}</label>` : '';
    };

    const etapeVerification = () => {
      if (depenses && etat.forme === 'operations') return verificationOperations();
      return verificationTableau();
    };

    const verificationOperations = () => {
      const { lignes, ecartees } = lignesOperations(etat.grille, etat.debut, etat.col,
        { ordre: ordreEffectif(), sens: etat.sens });
      const cats = expenseCategories();
      const propositions = proposerCategories(lignes, { regles: Store.state.budget.reglesImport || {},
        categories: cats, charges: Store.state.budget.fixedCharges || [] });
      if (!etat.choix || etat.choix.length !== lignes.length) etat.choix = propositions.map(p => p.choix);
      const groupes = new Map();
      lignes.forEach((l, i) => {
        if (l.credit) return;
        const cle = propositions[i].cle || normaliserTexte(l.libelle) || '?';
        if (!groupes.has(cle)) groupes.set(cle, []);
        groupes.get(cle).push(i);
      });
      const plan = planOperations(lignes, etat.choix);
      const aujourdhui = todayISO();
      const mois = Object.keys(plan.mois).sort();
      const etats = Object.fromEntries(mois.map(m => [m, etatMoisImport(m, plan.mois[m],
        Store.state.budget.expenses.find(x => x.month === m), aujourdhui, 'operations')]));
      for (const m of mois) if (!(m in etat.decisions)) etat.decisions[m] = etats[m].defaut;
      const rap = rapprochementOperations(lignes, ecartees, plan);
      const options = choix => `<option value=""${!choix ? ' selected' : ''}>${trad('À choisir')}</option>${
        cats.map(c => `<option value="${esc(c)}"${choix === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}
        <option value="${IGNORER}"${choix === IGNORER ? ' selected' : ''}>${trad('Ignorer')}</option>`;
      const groupesHtml = [...groupes.entries()]
        .map(([cle, ids]) => ({ cle, ids, total: ids.reduce((s, i) => s + lignes[i].montant, 0) }))
        .sort((a, b) => b.total - a.total)
        .map(({ cle, ids, total }) => {
          const valeurs = new Set(ids.map(i => etat.choix[i]));
          const commun = valeurs.size === 1 ? [...valeurs][0] : null;
          const raison = propositions[ids[0]].raison;
          return `<details class="imp-groupe">
            <summary><span class="imp-groupe-nom"><b>${esc(lignes[ids[0]].libelle || cle)}</b>
              <span class="sub">${ids.length > 1 ? `${ids.length} ${trad('lignes')} · ` : ''}${fmtEUR(total)}${
                raison === 'charge' && commun === IGNORER ? ` · ${trad('charge fixe ?')}` : ''}</span></span>
              <select data-groupe="${esc(cle)}" aria-label="${esc(lignes[ids[0]].libelle || cle)}">
                ${commun == null ? `<option value="__mixte" selected>${trad('Plusieurs')}</option>` : ''}${options(commun)}
              </select></summary>
            ${ids.map(i => `<div class="imp-ligne"><span>${esc(fmtDate(lignes[i].date))} · ${esc(lignes[i].libelle)}</span>
              <b>${fmtEUR(lignes[i].montant)}</b>
              <select data-ligne="${i}" aria-label="${esc(lignes[i].libelle)}">${options(etat.choix[i])}</select></div>`).join('')}
          </details>`;
        }).join('');
      const moisHtml = mois.map(m => {
        const e = etats[m], p = plan.mois[m];
        const bloque = e.aVenir && !etat.aVenir;
        const notes = [
          e.saisi ? `${trad('déjà saisi')} ${fmtEUR(e.total)}` : '',
          e.incomplet ? trad('du {a} au {b} : mois incomplet ?').replace('{a}', fmtDate(p.du)).replace('{b}', fmtDate(p.au)) : '',
          e.enCours ? trad('mois en cours') : '',
          e.aVenir ? trad('mois à venir') : '',
          e.disparues.length ? `${trad('disparaîtraient')} : ${e.disparues.map(x => `${x.categorie} ${fmtEUR(x.montant)}`).join(', ')}` : '',
        ].filter(Boolean).join(' · ');
        return `<div class="imp-mois"><span><b>${esc(fmtMonth(m))}</b> · ${fmtEUR(p.total)}${notes ? `<span class="sub">${esc(notes)}</span>` : ''}</span>
          <select data-mois="${m}"${bloque ? ' disabled' : ''} aria-label="${esc(fmtMonth(m))}">
            <option value="remplacer"${!bloque && etat.decisions[m] === 'remplacer' ? ' selected' : ''}>${e.saisi ? trad('Remplacer') : trad('Importer')}</option>
            <option value="garder"${bloque || etat.decisions[m] === 'garder' ? ' selected' : ''}>${e.saisi ? trad('Garder') : trad('Ne pas importer')}</option>
          </select></div>`;
      }).join('');
      const blocages = blocagesOperations({ col: etat.col, ordreADemander: ordreInfo().aDemander, ordre: etat.ordre,
        lignes, choix: etat.choix, ecartees, ecarteesAcceptees: etat.ecarteesAcceptees });
      const retenus = mois.filter(m => etat.decisions[m] === 'remplacer' && !(etats[m].aVenir && !etat.aVenir));
      $('#modalBody').innerHTML = `
        <p class="hint" style="margin:0 0 8px">${trad('Une catégorie par marchand : elle s’applique à toutes ses lignes, et Longward s’en souviendra. Ouvre un marchand pour changer une ligne seule.')}</p>
        <div class="imp-groupes">${groupesHtml || `<p class="empty">${trad('Aucune dépense dans ce fichier.')}</p>`}</div>
        <h3 class="imp-titre">${trad('Mois')}</h3>
        <div class="imp-liste">${moisHtml || `<p class="hint" style="margin:4px 0 0">${trad('Les mois apparaissent dès que leurs dépenses sont rangées.')}</p>`}</div>
        ${mois.some(m => etats[m].aVenir) ? `<label class="small row" style="gap:6px;margin-top:8px">
          <input type="checkbox" id="impAVenir" style="width:auto"${etat.aVenir ? ' checked' : ''}> ${trad('Importer aussi les mois à venir')}</label>` : ''}
        <p class="hint" style="margin:12px 0 0">${trad('Montants lus')} ${fmtEUR(rap.lu)} = ${trad('importés')} ${fmtEUR(rap.importe)}
          + ${trad('entrées d’argent')} ${fmtEUR(rap.credits)} + ${trad('ignorés')} ${fmtEUR(rap.ignore)}${
          rap.aClasser ? ` + ${trad('à classer')} ${fmtEUR(rap.aClasser)}` : ''} + ${trad('écartés')} ${fmtEUR(rap.ecarte)}${
          rap.illisibles ? ` · ${trad('{n} montants illisibles').replace('{n}', rap.illisibles)}` : ''}.
          ${plan.rapprochement.nCredits ? ` ${trad('Les entrées d’argent, remboursements compris, ne s’importent pas.')}` : ''}</p>
        ${listeEcartees(ecartees)}${caseEcartees(ecartees)}
        ${blocages.length ? `<div class="note" style="margin:12px 0 0">ⓘ <span>${blocages.map(b => esc(texteBlocage(b))).join('<br>')}</span></div>` : ''}`;
      piedVerification(blocages.length || !retenus.length, () => {
        const moisPlan = Object.fromEntries(retenus.map(m => [m, { v: plan.mois[m].v }]));
        const regles = {};
        for (const [cle, ids] of groupes) {
          const vals = new Set(ids.map(i => etat.choix[i]));
          if (etat.confirmes.has(cle) && vals.size === 1 && [...vals][0] && cle !== '?') regles[cle] = [...vals][0];
        }
        return { cible: 'depenses', forme: 'operations', mois: moisPlan, regles };
      }, retenus.length);
      for (const s of $$('#modalBody [data-groupe]')) {
        s.onclick = ev => ev.stopPropagation();
        s.onchange = () => {
          if (s.value === '__mixte') return;
          for (const i of groupes.get(s.dataset.groupe)) etat.choix[i] = s.value;
          etat.confirmes.add(s.dataset.groupe);
          verificationOperations();
        };
      }
      for (const s of $$('#modalBody [data-ligne]')) {
        s.onchange = () => {
          const i = +s.dataset.ligne;
          etat.choix[i] = s.value;
          const cle = [...groupes.entries()].find(([, ids]) => ids.includes(i));
          if (cle) {
            const vals = new Set(cle[1].map(k => etat.choix[k]));
            if (vals.size === 1 && s.value) etat.confirmes.add(cle[0]); else etat.confirmes.delete(cle[0]);
          }
          verificationOperations();
        };
      }
      lierCommuns(verificationOperations);
    };

    const texteEcartees = n => (n > 1
      ? trad('{n} lignes sont à vérifier (date ou montant illisible, débit et crédit ensemble) : écarte-les, ou corrige les colonnes.').replace('{n}', n)
      : trad('Une ligne est à vérifier (date ou montant illisible, débit et crédit ensemble) : écarte-la, ou corrige les colonnes.'));
    const texteBlocage = b => ({
      'sans-date': trad('Choisis la colonne des dates.'),
      'sans-montant': trad('Choisis la colonne des montants.'),
      ordre: trad('Indique comment se lisent les dates.'),
      'meme-colonne': trad('Le débit et le crédit viennent de la même colonne : choisis-en deux différentes.'),
      ecartees: texteEcartees(b.n),
      'a-choisir': b.n > 1 ? trad('{n} dépenses attendent une catégorie, ou Ignorer.').replace('{n}', b.n)
        : trad('Une dépense attend une catégorie, ou Ignorer.'),
    }[b.code] || b.code);

    const verificationTableau = () => {
      const cles = depenses ? etat.cibles.map(c => (c && c !== IGNORER ? c : null))
        : etat.cibles.map(cleCibleReleve);
      const colDate = depenses ? etat.colMois : etat.cibles.indexOf('date');
      const { lignes, ecartees, doublons } = lignesParMois(etat.grille, etat.debut, colDate, cles, ordreEffectif());
      const nonResolus = doublonsNonResolus(doublons, etat.doublons);
      const mois = planParMois(lignes, cible, etat.doublons);
      const aujourdhui = todayISO();
      const courant = `${aujourdhui.slice(0, 7)}-01`;
      const listeMois = Object.keys(mois).sort();
      const existant = m => (depenses ? Store.state.budget.expenses.find(x => x.month === m)
        : Store.state.monthly.find(x => x.date === m));
      const rempli = m => {
        const r = existant(m);
        return !!r && (depenses ? expenseRowTotalBrut(r) > 0.005 : !rowIsEmpty(r));
      };
      const nom = k => (depenses ? k : (ACC[k] || {}).label || k);
      const changements = m => {
        const r = existant(m), e = mois[m], out = [];
        for (const [k, x] of Object.entries(e.v)) {
          const avant = r && r.v ? r.v[k] : undefined;
          if (avant == null) out.push(`${nom(k)} ${fmtEUR(x)}`);
          else if (Math.abs(num(avant) - x) > 0.005) out.push(`${nom(k)} ${fmtEUR(num(avant))} → ${fmtEUR(x)}`);
        }
        if (e.dettes != null && (!r || Math.abs(num(r.dettes) - e.dettes) > 0.005)) {
          out.push(`${trad('crédits')} ${r && r.dettes != null ? `${fmtEUR(num(r.dettes))} → ` : ''}${fmtEUR(e.dettes)}`);
        }
        return out;
      };
      const retenus = listeMois.filter(m => !(m > courant && !etat.aVenir) && (!rempli(m) || etat.remplacer)
        && changements(m).length);
      const moisHtml = listeMois.map(m => {
        const ch = changements(m);
        const statut = m > courant ? trad('mois à venir') : rempli(m) ? trad('déjà rempli') : trad('nouveau');
        const pris = retenus.includes(m);
        return `<div class="imp-mois${pris ? '' : ' imp-garde'}"><span><b>${esc(fmtMonth(m))}</b> · ${esc(statut)}${
          pris ? '' : ` · ${ch.length ? trad('gardé tel quel') : trad('rien ne change')}`}${
          ch.length ? `<span class="sub">${esc(ch.join(' · '))}</span>` : ''}</span></div>`;
      }).join('');
      const doublonsHtml = Object.entries(doublons).map(([m, ns]) => `
        <div class="field"><label>${esc(fmtMonth(m))} ${trad('apparaît plusieurs fois')}</label>
          <select data-doublon="${m}">
            ${etat.doublons[m] == null ? `<option value="" selected>${trad('À choisir')}</option>` : ''}
            ${ns.map(n => `<option value="${n}"${etat.doublons[m] === n ? ' selected' : ''}>${trad('Garder la ligne {n}').replace('{n}', n + 1)}</option>`).join('')}
          </select></div>`).join('');
      const blocages = [];
      if (nonResolus.length) blocages.push(trad('Choisis la ligne à garder pour chaque mois en double.'));
      const aDecider = ecartees.filter(e => RAISONS_A_DECIDER.includes(e.raison)).length;
      if (aDecider && !etat.ecarteesAcceptees) blocages.push(texteEcartees(aDecider));
      if (ordreInfo().aDemander && !etat.ordre) blocages.push(trad('Indique comment se lisent les dates.'));
      $('#modalBody').innerHTML = `
        ${doublonsHtml}
        <div class="imp-liste">${moisHtml || `<p class="empty">${trad('Aucun mois lisible dans ce fichier.')}</p>`}</div>
        ${listeMois.some(rempli) ? `<label class="small row" style="gap:6px;margin-top:12px">
          <input type="checkbox" id="impRemplacer" style="width:auto"${etat.remplacer ? ' checked' : ''}>
          ${depenses ? trad('Remplacer aussi les mois déjà remplis (seules les catégories du fichier changent)')
                     : trad('Remplacer aussi les mois déjà remplis (seuls les comptes du fichier changent)')}</label>` : ''}
        ${listeMois.some(m => m > courant) ? `<label class="small row" style="gap:6px;margin-top:8px">
          <input type="checkbox" id="impAVenir" style="width:auto"${etat.aVenir ? ' checked' : ''}> ${trad('Importer aussi les mois à venir')}</label>` : ''}
        ${listeEcartees(ecartees)}${caseEcartees(ecartees)}
        ${blocages.length ? `<div class="note" style="margin:12px 0 0">ⓘ <span>${blocages.map(esc).join('<br>')}</span></div>` : ''}`;
      piedVerification(blocages.length || !retenus.length,
        () => ({ cible, forme: 'mois', mois: Object.fromEntries(retenus.map(m => [m, mois[m]])) }), retenus.length);
      for (const s of $$('#modalBody [data-doublon]')) {
        s.onchange = () => { etat.doublons[s.dataset.doublon] = s.value === '' ? undefined : +s.value; verificationTableau(); };
      }
      const r = $('#impRemplacer');
      if (r) r.onchange = () => { etat.remplacer = r.checked; verificationTableau(); };
      lierCommuns(verificationTableau);
    };

    const lierCommuns = refaire => {
      const e = $('#impEcarter');
      if (e) e.onchange = () => { etat.ecarteesAcceptees = e.checked; refaire(); };
      const v = $('#impAVenir');
      if (v) v.onchange = () => { etat.aVenir = v.checked; refaire(); };
      for (const s of $$('#modalBody [data-mois]')) s.onchange = () => { etat.decisions[s.dataset.mois] = s.value; refaire(); };
    };

    const piedVerification = (bloque, construire, n) => {
      $('#modalFoot').innerHTML = `<button class="btn" id="impOk" type="button"${bloque ? ' disabled' : ''}>${
        n > 1 ? trad('Importer {n} mois').replace('{n}', n) : trad('Importer')}</button>
        <button class="btn ghost" id="impRetour" type="button">${trad('Retour')}</button>`;
      $('#impRetour').onclick = () => etapeColonnes();
      $('#impOk').onclick = () => { if (!bloque) valider(construire()); };
    };

    const valider = async plan => {
      const r = await importerAvecSauvegarde(plan, () => askConfirm(
        `${trad('La sauvegarde n’a pas pu être prise.')}\n${trad('Importer quand même ?')}`, { ok: 'Importer quand même' }));
      if (r.statut === 'annule') return;
      if (r.statut === 'erreur') { toast(trad('L’import n’a pas pu se faire : rien n’a changé.')); return; }
      fermer(true);
      render();
      const n = Object.keys(plan.mois).length;
      toast(r.statut === 'session' ? trad('Importé dans cette session, mais pas enregistré sur l’appareil : le stockage refuse l’écriture.')
        : (n > 1 ? trad('{n} mois importés') : trad('{n} mois importé')).replace('{n}', n));
    };

    if (fichierDonne) lire(fichierDonne); else etapeFichier();
    montrerModal(m);
  });
}

partieChargee('assets/app-10-import-tableau.js');
