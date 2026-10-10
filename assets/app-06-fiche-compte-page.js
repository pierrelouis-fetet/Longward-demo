/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */
function carteUsageInconnu(c) {
  return `
  <div class="card">
    <div class="card-head"><h2>${trad('Usage du bien')}</h2></div>
    <p class="empty" style="margin:0">${trad('Les indicateurs mensuels apparaîtront une fois l’usage précisé : '
      + 'un logement habité a un coût mensuel, un bien loué a un rendement. '
      + 'Le choix se fait en haut de cette fiche.')}</p>
  </div>`;
}

function carteUsageLots(c) {
  const lots = (c.lignes || []).filter(l => (l.classe || 'immobilier') === 'immobilier');
  return `
  <div class="card">
    <div class="card-head"><h2>${trad('Usage du bien')}</h2>
      <span class="hint">${lots.length} ${trad('lots')}</span></div>
    <dl class="kv">
      ${lots.map(l => `<dt>${esc(l.libelle || trad('Lot'))}</dt>
        <dd class="phrase">${usageLigne(l)
          ? esc(trad(USAGE_BIEN_LABEL[usageLigne(l)])) : trad('à préciser')}</dd>`).join('')}
    </dl>
    <p class="hint" style="margin:12px 0 0">${trad('Les lots de ce bien n’ont pas le même usage : '
      + 'ni rendement ni coût global ne seraient justes ici. Ton patrimoine, lui, reste complet. '
      + 'L’usage de chaque lot se corrige plus haut, dans sa propre ligne.')}</p>
  </div>`;
}

/* Ce qu'un placement immobilier rapporte — et ce n'est pas un appartement.

   Une SCPI ne s'habite pas, ne se releve pas entre deux locataires, n'a pas de
   mois loues : sa societe de gestion porte tout cela, et le distribue deja net
   de sa propre vacance. Lui montrer « Loyer potentiel », « Vacance moyenne » ou
   « Mois loues par an » invite a saisir une seconde fois ce que la distribution
   contient, et le rendement affiche en sortirait deux fois ampute.

   La distinction vient du MODELE et non d'un libelle : `bienImmo` sans
   `direct`. Un REIT, un fonds, un support loge dans une enveloppe passent par
   la meme porte, sans qu'aucune liste de noms ait a exister.

   Le credit reste montre s'il y en a un : la SCPI a credit est un montage
   courant, et taire sa mensualite ferait disparaitre de l'argent qui sort
   vraiment. Le capital rembourse aussi, pour la meme raison. */
function cartePierrePapier(c, idx, cf) {
  const co = coutBien(c);
  const revenus = cf.loyersPleins;
  const net = revenus - cf.charges - cf.mensualite;
  const base = cf.base;
  const baseDite = cf.surAchat ? trad('le prix payé') : trad('la valeur actuelle');
  const tete = `
    <div class="card-head"><h2>${trad('Performance du placement')}</h2>
      ${revenus < 0.005 ? '' : `<span class="hint">${fmtEUR0(revenus)} ${
        trad('de distributions par mois')}</span>`}
      ${boutonsPierrePapier(c)}</div>`;
  if (revenus < 0.005 && co.totalSorties < 0.005) return `
  <div class="card">
    ${tete}
    <p class="empty" style="margin:0">${trad('Aucune distribution ni frais rattaché à ce '
      + 'placement. « + Distribution » crée un revenu déjà rattaché ; le rendement se calcule '
      + 'alors tout seul, sur le prix payé quand tu le connais.')}</p>
  </div>`;
  return `
  <div class="card">
    ${tete}
    <dl class="kv">
      ${revenus < 0.005 ? '' : (cf.sourcesLoyer.length === 1
        ? ligneSource({ nom: trad('Distributions'), montant: revenus, signe: 1,
            action: 'edit-income', donnees: { i: cf.sourcesLoyer[0].i } })
        : ligneTotal({ nom: 'Distributions', montant: revenus, signe: 1,
            aideTxt: 'Ce que ce placement te verse chaque mois. Chaque revenu se corrige dans le budget, où il porte son nom.' }))}
      ${ligneCharges(cf, -1, 'Frais')}
      ${ligneMensualite(cf, -1)}
      <dt><b>${trad('Net mensuel')}</b>${aide(trad('Les distributions moins les frais et la mensualité du crédit, s’il y en a un. La somme des lignes au-dessus.'))}</dt>
        <dd class="${cls(net)}"><b>${fmtSigned(net)} ${trad('/ mois')}</b></dd>
    </dl>
    ${blocCapitalRembourse(co)}
    ${noteVentilation(co)}
    ${revenus < 0.005 ? '' : `
    <dl class="kv" style="margin-top:12px">
      ${ligneRendement({ nom: 'Rendement brut',
        valeur: base > 0 ? revenus * 12 / base * 100 : null,
        aideTxt: 'Distributions annuelles rapportées à la base indiquée. C’est le rendement que la société de gestion publie, si tu as saisi ton prix de souscription.',
        sub: `${trad('sur')} ${baseDite}, ${fmtEUR0(base)}` })}
      ${!cf.charges ? '' : ligneRendement({ nom: 'Rendement net de frais',
        valeur: base > 0 ? (revenus - cf.charges) * 12 / base * 100 : null })}
    </dl>`}
  </div>`;
}

const CARTES_USAGE = {
  principale: (c, idx, cf) => carteResidence(c, idx, cf, 'principale'),
  secondaire: (c, idx, cf) => carteResidence(c, idx, cf, 'secondaire'),
  locative: (c, idx, cf) => carteLocatif(c, idx, cf),
};

function carteUsageBien(c, idx) {
  const cf = cashFlowBien(c);
  if (!cf) return '';
  if (!estBienEnDirect(c)) return cartePierrePapier(c, idx, cf);
  const u = usageEffectifBien(c);
  if (u.action === 'lots') return carteUsageLots(c);
  const rendre = CARTES_USAGE[u.usage];
  return rendre ? rendre(c, idx, cf) : carteUsageInconnu(c);
}

function carteAcquisition(c, idx) {
  if (!estBienEnDirect(c)) return '';
  const lots = (c.lignes || []).map((l, i) => ({ l, i }))
    .filter(({ l }) => (l.classe || 'immobilier') === 'immobilier');
  if (!lots.length) return '';
  const acq = acquisitionCompte(c);
  const plusieurs = lots.length > 1;
  const champ = (i, cle, label, aideTxt, l) => `
        <div class="field"><label>${trad(label)}${aideTxt ? aide(trad(aideTxt)) : ''}</label>
          <input type="number" step="any" class="champ-large"
                 data-path="comptes.${idx}.lignes.${i}.${cle}"
                 value="${estDeclare(l[cle]) ? num(l[cle]) : ''}"
                 placeholder="${trad('facultatif')}"></div>`;
  return `
  <div class="card">
    <div class="card-head"><h2>${trad('Acquisition')}</h2>
      ${acq.total == null ? '' : `<span class="hint">${fmtEUR0(acq.total)} ${
        trad('au total')}</span>`}</div>
    ${lots.map(({ l, i }) => {
      const a = acquisitionLigne(l);
      return `
      ${!plusieurs ? '' : `<p class="sous-titre-carte">${esc(l.libelle || trad('Lot'))}</p>`}
      <div class="grid g-2 g-paire">
        ${champ(i, 'prixAchat', 'Prix d’achat ({dev})',
          'Le prix du bien seul, hors frais de notaire et hors travaux. C’est celui qui figure sur le compromis.', l)}
        ${champ(i, 'fraisAcquisition', 'Frais d’acquisition ({dev})',
          'Notaire, garantie, frais de dossier, commission d’agence. Ils sont partis en frais le jour de l’achat et ne se revendent pas.', l)}
      </div>
      <div class="grid g-2 g-paire">
        ${champ(i, 'travauxInitiaux', 'Travaux initiaux ({dev})',
          'Ce que tu as engagé pour le mettre en état avant d’y vivre ou de le louer. Les travaux d’entretien qui suivent sont des charges, pas de l’acquisition.', l)}
      </div>
      ${(() => {
        if (a.complet) return '';
        if (a.source === 'legacy') return `
      <p class="hint" style="margin:0 0 12px">${trad('Coût total d’acquisition')} <b>${
        fmtEUR0(a.total)}</b> · ${a.sousTotal == null
          ? `${trad('Détail non renseigné')}. ${trad('Renseigne le prix d’achat ci-dessus pour le décomposer : rien n’est deviné à partir du total.')}`
          : `${trad('Sous-total renseigné')} ${fmtEUR0(a.sousTotal)}. ${
              trad('Renseigne les trois montants pour que le détail remplace le total : tant qu’il en manque un, c’est le total connu qui fait foi.')}`}</p>`;
        if (a.source === 'partiel') return `
      <p class="hint" style="margin:0 0 12px">${trad('Sous-total renseigné')} <b>${
        fmtEUR0(a.sousTotal)}</b> · ${trad('Coût total')} ${trad('À compléter')}. ${
        trad('Renseigne les trois montants (prix, frais, travaux) pour obtenir un coût total. Un poste manquant n’est pas un poste à zéro.')}</p>`;
        return '';
      })()}`;
    }).join('')}
    <dl class="kv" style="margin-top:12px">
      ${acq.total != null ? `<dt><b>${trad('Coût total d’acquisition')}</b>${
        aide(trad('Le prix d’achat, les frais et les travaux initiaux additionnés. C’est lui qui sert de base aux rendements, et de repère à l’écart avec la valeur d’aujourd’hui.'))}</dt>
        <dd><b>${fmtEUR(acq.total)}</b></dd>`
      : acq.sousTotal == null && !acq.connus ? '' : `${acq.sousTotal == null ? '' : `<dt>${trad('Sous-total renseigné')}</dt>
        <dd>${fmtEUR(acq.sousTotal)}</dd>`}
      <dt><b>${trad('Coût total d’acquisition')}</b></dt>
        <dd class="muted">${trad('À compléter')}${!acq.sansCout ? '' : ` · ${acq.sansCout} ${
          trad(acq.sansCout > 1 ? 'lots sans coût' : 'lot sans coût')}`}</dd>`}
    </dl>
    <div class="field" style="margin-top:12px">
      <label>${trad('Apport initial ({dev})')}${aide(trad('Ce que tu as sorti de ta poche le jour de l’achat. C’est un fait historique : il ne s’ajoute pas à ton patrimoine aujourd’hui, il ne se retire pas de ton cash, et il ne change pas la valeur nette du bien. Il sert à lire le financement, et le rendement sur apport d’un locatif.'))}</label>
      <input type="number" step="any" class="champ-large"
             data-path="comptes.${idx}.apport" value="${estDeclare(c.apport) ? num(c.apport) : ''}"
             placeholder="${trad('facultatif')}"></div>
    ${blocFinancementInitial(c)}
  </div>`;
}

function blocFinancementInitial(c) {
  const plan = planFinancement(c);
  if (!plan) return '';
  if (!plan.complet) return `
    <p class="hint" style="margin:8px 0 0">${plan.manque === 'apport'
      ? trad('Renseigne l’apport pour voir comment l’acquisition a été financée.')
      : trad('Renseigne le capital emprunté au départ de chaque crédit pour voir comment l’acquisition a été financée.')}</p>`;
  const ecart = ecartAExpliquer(plan);
  return `
    <dl class="kv" style="margin-top:12px">
      <dt>${trad('Apport initial')}</dt><dd>${fmtEUR(plan.apport)}</dd>
      <dt>${trad('Capital emprunté au départ')}</dt><dd>${fmtEUR(plan.emprunte)}</dd>
      <dt class="kv-sous">${trad('Financement renseigné')}</dt>
        <dd>${fmtEUR(plan.finance)}</dd>
      ${!ecart ? '' : `<dt>${trad('Écart à expliquer')}${
        aide(trad('La différence entre ce que tu as déclaré avoir financé et le coût total. Ce n’est pas forcément une erreur : des frais payés autrement, un prêt travaux, une aide familiale, des frais financés avec le prêt.'))}</dt>
        <dd class="muted">${montantSigne(plan.ecart)}</dd>`}
    </dl>
    ${!ecart ? '' : `<p class="hint" style="margin:8px 0 0">${
      trad('Le financement renseigné ne couvre pas exactement le coût d’acquisition.')}</p>`}`;
}

function carteCredit(c, d, i, idxEtab) {
  const prog = progressionCredit(d);
  const mens = mensualiteCredit(d);
  const partage = creditPartage(d);
  const amort = mensualiteAmortissante(d);
  const e = echeancierCredit(d);
  const f = finCredit(d);
  const assur = assuranceMensuelleCredit(d);
  const base = baseAssuranceCredit(d);
  const ventile = e && e.capitalDuMois != null;
  const taux = tauxCreditDeclare(d);
  return `
      <div class="pret">
        <div class="bien-tete">
          <span class="cpt-nom"><button type="button" class="lien-nu"
                  data-action="editer-credit" data-etab="${esc(c.etabId)}" data-i="${i}"
                  title="${trad('Renommer, corriger ou supprimer')}">${esc(d.libelle)}</button>
            ${!d.preteur ? '' : `<span class="sub">${esc(d.preteur)}</span>`}</span>
          <b class="dette">−${fmtEUR(num(d.montant))}</b>
        </div>
        ${prog.initial == null ? '' : `
          <div class="goal-bar"><div class="goal-fill"
               style="width:${Math.min(100, Math.max(0, prog.pct || 0)).toFixed(1)}%; background:var(--good)"></div></div>`}
        <dl class="kv" style="margin-top:12px">
          <dt>${trad('Capital restant dû')}</dt>
            <dd>${prog.initial == null ? `<b>${fmtEUR(num(d.montant))}</b>`
              : `<b>${fmtEUR0(num(d.montant))}</b> <span class="muted">/ ${
                  fmtEUR0(prog.initial)}</span>`}</dd>
          ${prog.rembourse == null ? '' : `<dt>${trad('Capital remboursé')}${
            aide(trad('Le capital emprunté au départ moins ce que tu dois encore. Les intérêts et l’assurance déjà payés n’en font pas partie : ils ne réduisent pas la dette.'))}</dt>
            <dd class="up">${fmtEUR0(prog.rembourse)} <span class="muted">· ${
              fmtPct(prog.pct, 0)}</span></dd>`}
          ${!(mens > 0) ? '' : `<dt>${trad(partage ? 'Mensualité facturée' : 'Mensualité totale')}${
            aide(trad('Ce qui sort de ton compte chaque mois pour ce prêt, assurance emprunteur incluse. C’est ce montant que le budget compte, et il ne se dédouble pas avec une charge d’assurance séparée.'))}
            <span class="sub">${trad('assurance incluse')}</span></dt>
            <dd><b>${fmtEUR(mens)} ${trad('/ mois')}</b></dd>`}
          ${!(mens > 0) || !partage ? '' : `<dt>${trad('Ta part amortissante')}${
            aide(trad('La part de la mensualité qui rembourse ta dette : c’est sur elle que se calculent le capital du mois, la date de fin et la projection.'))}
            <span class="sub">${fmtPct(partCredit(d) * 100, 0)}</span></dt>
            <dd>${fmtEUR(amort)} ${trad('/ mois')}</dd>`}
        </dl>
        ${!ventile ? '' : `
        <dl class="kv" style="margin-top:12px">
          <dt class="kv-sous">${trad('Capital ce mois')}</dt>
            <dd class="${e.capitalDuMois > 0.005 ? 'up' : ''}">${
              e.capitalDuMois > 0.005 ? `+${fmtEUR(e.capitalDuMois)}` : fmtEUR(0)}</dd>
          <dt>${trad('Intérêts')}</dt><dd>${fmtEUR(e.interetsDuMois)}</dd>
          ${!(assur > 0.005) ? '' : `<dt>${trad('Assurance')}${base.sur === 'initial' ? '' :
            aide(trad('Estimée sur le capital restant dû, faute de capital emprunté renseigné : la plupart des contrats la calculent sur le capital emprunté, donc la prime réelle est probablement un peu plus élevée.'))}</dt>
            <dd>${fmtEUR(assur)}</dd>`}
          ${taux == null ? '' : `<dt>${trad('Taux')}</dt><dd>${fmtPct(taux, 2)}</dd>`}
          ${!f ? '' : `<dt>${trad('Fin estimée')}${
            aide(trad('Calculé depuis ton capital restant dû, ta mensualité et ton taux. Un remboursement anticipé ou une renégociation avance cette date : elle se recalcule dès que tu corriges le capital.'))}
            <span class="sub">${fmtDureeMois(f.mois)}</span></dt>
            <dd><b>${esc(fmtMoisAn(f.finLe))}</b></dd>
          <dt>${trad('Intérêts restants')}${
            aide(trad("Ce que ce crédit te coûtera encore, du premier au dernier mois. Ce n'est pas une dette de plus : c'est le prix du temps, déjà compris dans tes mensualités."))}</dt>
            <dd class="dette">−${fmtEUR0(f.interets)}</dd>`}
        </dl>
        ${!e.depuisProjection || !d.verifieLe ? '' : `<p class="hint" style="margin:8px 0 0">${
          trad('Calculé depuis le solde estimé d’aujourd’hui, à partir du solde vérifié le {d}.')
            .replace('{d}', esc(fmtDate(d.verifieLe)))}</p>`}
        ${assuranceDeclaree(d) ? '' : `<p class="hint" style="margin:8px 0 0">${
          trad('Taux d’assurance non renseigné : l’estimation la suppose nulle, ce qui peut surestimer le capital remboursé et avancer la date de fin.')}</p>`}`}
        ${!prog.incoherent ? '' : `<div class="note" style="margin-top:12px">⚠ <span>${
          trad('Le capital restant dû dépasse le capital emprunté au départ.')} ${
          trad('Ce peut être un prêt rechargeable ou des frais financés ; ce peut aussi être une saisie à corriger. Longward ne tranche pas.')}</span></div>`}
        ${!prog.invalide ? '' : `<div class="note" style="margin-top:12px">⚠ <span>${
          trad('Le capital emprunté au départ est déclaré à zéro alors qu’il reste une dette.')} ${
          trad('Ce peut être un prêt rechargeable ou des frais financés ; ce peut aussi être une saisie à corriger. Longward ne tranche pas.')}</span></div>`}
        ${prog.initial != null || prog.invalide ? '' : `<p class="hint" style="margin:12px 0 0">${
          trad('Renseigne le capital emprunté au départ pour voir ce qui est déjà remboursé.')}</p>`}
        ${taux != null || !num(d.montant) ? '' : `<p class="hint" style="margin:12px 0 0">${
          trad('Renseigne le taux pour estimer la répartition capital/intérêts et la date de fin.')}</p>`}
        ${!ventile || f || !num(d.montant) ? '' : `<p class="hint" style="margin:12px 0 0">${
          trad('La mensualité actuelle ne réduit pas le capital : elle ne couvre que les intérêts et l’assurance.')}</p>`}
        ${(() => {
          const r = resteAPayer(d);
          if (!r) return '';
          const reduite = f && f.derniere < amort - 1;
          const derniere = r.assurance > 0.5 || reduite;
          if (!derniere) return '';
          return `
        <dl class="kv" style="margin-top:12px">
          ${r.assurance > 0.5 ? `<dt>${trad('Assurance restante')}</dt>
            <dd>${fmtEUR0(r.assurance)}</dd>` : ''}
          ${reduite ? `<dt>${trad(partage ? 'Dernière échéance, ta part' : 'Dernière échéance')}${
            aide(trad('Elle solde le reliquat, elle est donc plus petite que les autres.'))}</dt>
            <dd class="muted">${fmtEUR(f.derniere)}</dd>` : ''}
        </dl>`;
        })()}
        ${(() => {
          const pr = projectionCredit(d);
          if (!pr || pr.projete == null || Math.abs(pr.ecart || 0) < 1) return '';
          return `
        <dl class="kv" style="margin-top:12px">
          <dt>${trad('Estimation aujourd’hui')}${
            aide(trad('Ce que ton capital restant dû vaudrait si les mensualités s’étaient enchaînées depuis ta dernière vérification. Longward ne l’écrit jamais à ta place.'))}
            <span class="sub">${trad('vérifié le')} ${esc(fmtDate(d.verifieLe))}</span></dt>
            <dd class="muted">${fmtEUR0(pr.projete)}</dd>
        </dl>`;
        })()}
        <div class="grid g-3" style="margin-top:12px">
          <div class="field"><label>${trad('Capital emprunté au départ ({dev})')}${
            aide(trad('Ce que la banque t’a prêté le jour de la signature. Il ne bouge jamais, contrairement au capital restant dû : c’est lui qui dit quelle part tu as déjà remboursée.'))}</label>
            <input type="number" step="any" class="champ-large"
                   data-path="etabs.${idxEtab}.dettes.${i}.initial"
                   value="${estDeclare(d.initial) ? num(d.initial) : ''}"
                   placeholder="${trad('facultatif')}"></div>
          ${chargeDuCredit(d.id) ? `
          <div class="field"><label>${trad('Mensualité ({dev})')}${aide(trad("Elle se règle dans la charge fixe qui rembourse ce crédit, pour n'exister qu'à un seul endroit. Un second champ ici laisserait les deux diverger, et c'est celui-ci que rien ne relirait."))}</label>
            <p class="hint" style="margin:0">${fmtEUR(mens)} ${trad('par mois, depuis la charge')}
              <b>${esc(chargeDuCredit(d.id).charge.label || trad('Charge fixe'))}</b></p></div>`
          : `
          <div class="field"><label>${trad('Mensualité totale ({dev})')}${
            aide(trad('Assurance emprunteur incluse : c’est le prélèvement que tu vois sur ton relevé.'))}</label>
            <input type="number" step="any" class="champ-large"
                   data-path="etabs.${idxEtab}.dettes.${i}.mensualite"
                   value="${estDeclare(d.mensualite) ? num(d.mensualite) : ''}"></div>`}
          <div class="field"><label>${trad('Taux annuel (%)')}${aide(trad("Il donne la date de fin du crédit, ce qu'il te reste à payer d'intérêts, et la part de capital de chaque mensualité. Ton capital restant dû, lui, reste celui que tu saisis : jamais un montant projeté."))}</label>
            <input type="number" step="0.01" class="champ-large"
                   data-path="etabs.${idxEtab}.dettes.${i}.taux"
                   value="${estDeclare(d.taux) ? num(d.taux) : ''}"></div>
          <div class="field"><label>${trad('Taux d’assurance (%)')}${
            aide(trad('Le taux annuel de l’assurance emprunteur. Il sert à ventiler la mensualité ; il ne crée aucune sortie de plus, l’assurance étant déjà comprise dedans.'))}</label>
            <input type="number" step="0.01" class="champ-large"
                   data-path="etabs.${idxEtab}.dettes.${i}.tauxAssurance"
                   value="${estDeclare(d.tauxAssurance) ? num(d.tauxAssurance) : ''}"
                   placeholder="${trad('facultatif')}"></div>
          <div class="field"><label>${trad('Banque / prêteur')}</label>
            <input class="champ-large" style="text-align:left"
                   data-path="etabs.${idxEtab}.dettes.${i}.preteur"
                   value="${esc(d.preteur || '')}" placeholder="${trad('ex. Ma banque')}"></div>
        </div>
      </div>`;
}

function espaceBien(c, idx, t) {
  if (!estBien(t)) return '';
  const biens = (c.lignes || []).map((l, i) => ({ l, i }))
    .filter(({ l }) => (l.classe || 'immobilier') === 'immobilier');
  const { idxEtab, dettes, total: credit } = creditsDuCompte(c);
  const entiere = biens.reduce((s, { l }) => s + num(l.valeur), 0);
  const acq = acquisitionCompte(c);
  const coutConnu = acq.total != null && !acq.partInvalide;
  const achatEntier = coutConnu ? acq.entier : 0;
  const partsInvalides = biens.filter(({ l }) => partDetention(l) === null);
  const valeur = biens.reduce((s, { l }) =>
    s + num(l.valeur) * (partDetention(l) ?? 0), 0);
  const achat = coutConnu ? acq.detenu : 0;
  const partagee = Math.abs(entiere - valeur) > 0.005;
  const gain = achat ? valeur - achat : null;
  /* Une SCPI passe par cette fiche comme un bien, sans en etre un : elle a des
     parts, un prix que publie sa societe de gestion, et ni notaire, ni
     indivision, ni annonces. `pierre` choisit ses mots. */
  const pierre = !estBienEnDirect(c);

  return `
  <div class="card" data-anchor="estimation">
    ${(() => {
      const u = usageEffectifBien(c);
      if (!u.action) return '';
      const DEMANDES = {
        confirmer: { titre: 'Usage à confirmer',
          quoi: 'Considéré comme mis en location car un loyer est rattaché à ce bien.',
          bouton: 'Confirmer l’usage' },
        choisir: { titre: 'Usage à préciser',
          quoi: 'Personne n’a encore dit si tu l’habites ou si tu le loues.',
          bouton: 'Choisir l’usage' },
        lots: { titre: 'Usages différents selon les lots',
          quoi: 'Certains lots n’ont pas le même usage. Modifie chaque lot séparément.',
          bouton: null },
        partiel: { titre: 'Usage à préciser sur un lot',
          quoi: 'Un lot de ce bien n’a pas encore d’usage. Précise-le dans sa propre ligne, plus bas.',
          bouton: null },
      };
      const q = DEMANDES[u.source === 'partiel' ? 'partiel' : u.action];
      return `
    <p class="perimetre" style="margin:0 0 12px">
      <b>${trad(q.titre)}</b>
      ${trad(q.quoi)}
      ${!q.bouton ? '' : `<button type="button" class="btn xs" data-action="choisir-usage"
              data-id="${esc(c.id)}" style="margin-left:8px">${trad(q.bouton)}</button>`}
    </p>`;
    })()}
    <div class="card-head"><h2>${trad('Mettre à jour')}</h2>
      <span class="hint">${trad('ce qui vieillit')}</span></div>
    <p class="hint" style="margin:0 0 8px">${pierre
      ? trad('Les deux chiffres qui bougent : ce que valent tes parts, et ce qu’il reste à rembourser. « Enregistrer » les date du jour, même inchangés.')
      : trad('Les deux chiffres qui bougent : ce que vaut le bien, et ce qu’il reste à rembourser. « Enregistrer » les date du jour, même inchangés.')}</p>
    ${biens.map(({ l, i }, k) => `
      <div class="grid g-2 g-paire">
        <div class="field"><label>${pierre ? trad('Valeur des parts ({dev})') : trad('Valeur estimée ({dev})')}${biens.length > 1 && l.libelle ? ` · ${esc(l.libelle)}` : ''}${aide(pierre ? trad(AIDE_VALEUR_PARTS) : trad("Ce qu'un acheteur te paierait aujourd'hui, frais de notaire exclus : ceux-là sont partis en taxes le jour de l'achat et ne se revendent pas. C'est pour ça qu'un achat récent financé à crédit peut afficher un patrimoine net négatif, sans que rien ne soit faux."))}</label>
          <input type="number" step="any" class="champ-large"
                 data-path="comptes.${idx}.lignes.${i}.valeur" value="${num(l.valeur)}"${k ? '' : ' data-anchor-focus'}>
          ${!pierre ? '' : `<p class="hint" style="margin:4px 0 0">${(u => !u
            ? trad('Indique ton nombre de parts pour pouvoir en céder une partie.')
            : u.valeur != null ? `${fmtNombre(u.parts)} ${trad('parts')} · ${fmtPart(u.valeur)} ${trad('la part')}`
            : `${fmtNombre(u.parts)} ${trad('parts')}`)(prixParPart(l))}</p>`}</div>
        <div class="field"><label>${trad(pierre ? 'Valeur au' : 'Estimée le')}${aide(trad(pierre ? 'le jour où tu as lu ce prix' : 'le jour où tu as établi ce chiffre'))}</label>
          <input type="date" data-path="comptes.${idx}.lignes.${i}.estimeLe"
                 value="${esc(l.estimeLe || '')}">
          ${l.estimeLe ? '' : `<p class="hint" style="margin:4px 0 0">${trad(pierre ? 'valeur sans date' : 'estimation sans date')}</p>`}</div>
      </div>
      ${!pierre ? '' : `<div class="row" style="gap:8px;margin:0 0 12px">
        <button type="button" class="btn sm ghost" data-action="editer-placement" data-id="${esc(c.id)}" data-i="${i}">${trad('Parts et prix de la part')}</button>
        <button type="button" class="btn sm ghost" data-action="ceder-placement" data-id="${esc(c.id)}" data-i="${i}">${trad('Céder des parts')}</button>
      </div>`}`).join('')}
    ${dettes.map(({ d, i }) => `
      <div class="grid g-2 g-paire" data-anchor="credit">
        <div class="field"><label>${trad('Capital restant dû ({dev})')} · ${esc(d.libelle || trad('Crédit'))}</label>
          <input type="number" step="any" class="champ-large"
                 data-path="etabs.${idxEtab}.dettes.${i}.montant" value="${num(d.montant)}" data-anchor-focus></div>
        <div class="field"><label>${trad('Vérifié le')}${aide(trad('le jour où tu as lu ce capital chez ta banque'))}</label>
          <input type="date" data-path="etabs.${idxEtab}.dettes.${i}.verifieLe"
                 value="${esc(d.verifieLe || '')}">
          ${d.verifieLe ? '' : `<p class="hint" style="margin:4px 0 0">${trad('capital restant dû jamais vérifié')}</p>`}</div>
      </div>`).join('')}
    ${!credit ? '' : `<dl class="kv" style="margin-top:4px">
      <dt><b>${trad('Valeur nette')}</b>${aide(pierre ? trad("La valeur de tes parts moins ce qu'il reste à rembourser. C'est ce montant qui compte dans ton patrimoine net.") : trad("La valeur du bien moins ce qu'il reste à rembourser. C'est ce montant qui compte dans ton patrimoine net."))}</dt>
      <dd><b>${fmtEUR(valeur - credit)}</b></dd></dl>`}
    ${barreValiderFiche('accounts', 'bien', { credits: dettes.length })}
  </div>

  <div class="card">
    <div class="card-head"><h2>${pierre ? trad('Le placement') : trad('Le bien')}</h2>
      <span class="hint">${biens.length > 1
        ? `${biens.length} ${trad(pierre ? 'lignes' : 'lots')}` : esc(trad(t.label))}</span></div>
    ${biens.map(({ l, i }) => `
      <div class="modal-champs">
        <div class="field"><label>${trad(pierre ? 'Nom du placement' : 'Nom du bien')}</label>
          <input data-action-change="renommer-bien" data-compte="${esc(c.id)}" data-i="${i}"
                 value="${esc(l.libelle || '')}" placeholder="${trad(pierre ? 'ex. Ma SCPI' : 'ex. Studio Lyon 3e')}"></div>
        <div class="grid g-2 g-paire">
          <div class="field"><label>${trad('Date d\'acquisition')}</label>
            <input type="date" data-path="comptes.${idx}.lignes.${i}.dateAcquisition"
                   value="${esc(l.dateAcquisition || '')}"></div>
          ${pierre && !estDeclare(l.part) ? '' : `<div class="field"><label>${trad('Ta part (%)')}${aide(pierre ? trad('Une ancienne quote-part : ton patrimoine ne compte que cette fraction de la valeur ci-dessus. Pour une SCPI, inscris plutôt tes seules parts, et vide ce champ.') : trad("À remplir seulement si tu détiens ce bien à plusieurs : indivision, SCI, achat en couple sur deux tableaux de bord. Ton patrimoine ne compte alors que ta part. La valeur ci-dessus reste celle du bien entier, c'est elle que tu compares aux annonces. Elle ne répartit rien d'autre : le crédit se saisit tel que tu le dois, les loyers et les charges tels que tu les reçois et les paies. Si la mensualité d'un prêt commun est facturée pour deux, indique ta part dans la fenêtre du crédit."))}</label>
            <input type="number" step="any" min="0" max="100" class="champ-large"
                   data-path="comptes.${idx}.lignes.${i}.part" value="${estDeclare(l.part) ? num(l.part) : ''}"
                   placeholder="100">
            ${partEstValide(l.part) ? '' : `<p class="hint" style="margin:4px 0 0">${
              trad('La quote-part doit être comprise entre 0 et 100 %.')}</p>`}</div>`}
        </div>
        <div class="grid g-2 g-paire">
          ${!estBienEnDirect(c) ? '' : `<div class="field"><label>${trad('Usage')}${aide(trad("Il décide de ce que la fiche te montre : un logement mis en location a un rendement, celui que tu habites a un coût. Ta résidence principale sort aussi des avoirs mobilisables en quelques mois, parce que la vendre veut dire te reloger."))}</label>
            <select data-path="comptes.${idx}.lignes.${i}.usage" class="annee">
              <option value="">${trad('à préciser')}</option>
              ${USAGES_BIEN.map(([cle, label]) => `<option value="${cle}"
                ${usageLigne(l) === cle ? 'selected' : ''}>${trad(label)}</option>`).join('')}
            </select></div>`}
          ${!estBienEnDirect(c) ? '' : `<div class="field"><label>${trad('Surface (m²)')}${aide(trad("Elle donne le prix au mètre carré, le seul chiffre qui permette de confronter ton estimation aux annonces du quartier. Sans elle, « 150 000 {dev} » ne se vérifie contre rien."))}</label>
            <input type="number" step="any" class="champ-large"
                   data-path="comptes.${idx}.lignes.${i}.surface" value="${num(l.surface) || ''}"></div>`}
        </div>
        ${!estBienEnDirect(c) ? '' : `<div class="field"><label>${trad('Adresse')}</label>
          <textarea rows="3" data-path="comptes.${idx}.lignes.${i}.adresse"
                    placeholder="${trad('facultatif')}"
                    style="text-align:left">${esc(l.adresse || '')}</textarea></div>`}
      </div>`).join('')}
    ${(() => {
      const surface = biens.reduce((s, { l }) => s + num(l.surface), 0);
      if (!estBienEnDirect(c) || !surface || !entiere) return '';
      return `<dl class="kv" style="margin-top:12px">
        <dt>${trad('Prix au m²')}<span class="sub">${trad('{v} m² au total')
          .replace('{v}', fmtNombre(surface))}</span></dt>
        <dd><b>${fmtEUR0(entiere / surface)}</b> / m²${achatEntier ? `
          <span class="muted">${trad('acheté')} ${fmtEUR0(achatEntier / surface)}</span>` : ''}</dd>
      </dl>`;
    })()}
    <dl class="kv" style="margin-top:12px">
      <dt>${trad('Valeur actuelle')}</dt><dd><b>${fmtEUR(entiere)}</b></dd>
      ${!partagee ? '' : `<dt>${trad('Ta part')}${aide(pierre ? trad('Ton patrimoine ne compte que cette fraction de la valeur des parts inscrites.') : trad("Ton patrimoine ne compte que cette fraction. La ligne au-dessus reste la valeur du bien entier."))}
        <span class="sub">${biens.map(({ l }) => partDetention(l) == null
          ? trad('à corriger') : fmtPct(partDetention(l) * 100, 0)).join(', ')}</span></dt>
        <dd><b>${fmtEUR(valeur)}</b></dd>`}
      ${!credit ? '' : `<dt>${trad('Capital restant dû')}</dt>
        <dd class="dette">−${fmtEUR(credit)}</dd>`}
      ${!credit && !estBienEnDirect(c) ? '' : `<dt><b>${trad('Valeur nette')}</b>${aide(pierre ? trad("La valeur de tes parts moins ce qu'il reste à rembourser. C'est ce montant qui compte dans ton patrimoine net.") : trad("La valeur du bien moins ce qu'il reste à rembourser. C'est ce montant qui compte dans ton patrimoine net."))}</dt>
        <dd><b>${fmtEUR(valeur - credit)}</b></dd>`}
      ${(() => {
        const u = usageEffectifBien(c);
        return !u.usage ? '' : `<dt>${trad('Usage')}</dt>
        <dd class="phrase">${esc(trad(USAGE_BIEN_LABEL[u.usage]))}</dd>`;
      })()}
      ${gain == null ? '' : `<dt>${trad('Écart vs coût d’acquisition')}${
        aide(trad(partagee
          ? 'La valeur de ta part moins le coût d’acquisition de ta part. Ce n’est pas une plus-value : Longward ne connaît ni les frais de revente ni la fiscalité de cession.'
          : 'La valeur d’aujourd’hui moins le coût total d’acquisition. Ce n’est pas une plus-value : Longward ne connaît ni les frais de revente ni la fiscalité de cession.'))}</dt>
        <dd class="${cls(gain)}">${fmtSigned(gain)}
          <span class="muted">${fmtSignedPct((valeur / achat - 1) * 100, 1)}</span></dd>`}
    </dl>
  </div>

  ${carteAcquisition(c, idx)}

  ${carteUsageBien(c, idx)}

  <div class="card">
    <div class="card-head"><h2>${trad('Financement')}</h2>
      <button class="btn sm ghost" data-action="ajouter-credit" data-id="${esc(c.etabId)}">${trad('+ Crédit')}</button></div>
    ${!dettes.length ? `
      <div class="empty">
        <p style="margin:0 0 12px">${pierre
          ? trad('Aucun crédit déclaré : le placement est compté en entier dans ton patrimoine, et sa valeur nette est donc sa valeur tout court.')
          : trad('Aucun crédit déclaré : le bien est compté '
          + 'en entier dans ton patrimoine, et sa valeur nette est donc sa valeur tout '
          + 'court.')}</p>
        <button class="btn sm" data-action="ajouter-credit" data-id="${esc(c.etabId)}">
          ${pierre ? trad('+ Déclarer un crédit sur ce placement') : trad('+ Déclarer un crédit sur ce bien')}</button>
      </div>` : dettes.map(({ d, i }) => carteCredit(c, d, i, idxEtab)).join('')}
    ${credit ? `<p class="small muted" style="margin:12px 0 0">${
      (pierre ? trad('Après chaque mensualité, baisse le capital restant dû : ton patrimoine net monte d’autant, sans que la valeur de tes parts change. Le crédit est porté par {e}, il se retrouve aussi sur sa fiche.')
      : trad('Après chaque mensualité, baisse le capital restant dû : ton patrimoine net '
      + 'monte d’autant, sans que la valeur du bien change. Le crédit est porté par {e}, '
      + 'il se retrouve aussi sur sa fiche.')).replace('{e}', esc(nomEtabDe(c)))}
    </p>` : ''}
  </div>`;
}

/* Un bouton « Enregistrer » sur une fiche, alors que tout y est deja ecrit.

   La regle du projet dit qu'une page ecrit a la frappe et qu'un bouton
   « Enregistrer » y serait pire : on corrige un montant en haut, on descend, on
   quitte, et un bouton non clique aurait tout jete. Ce bouton-ci ne change donc
   rien a l'ecriture — elle a deja eu lieu, champ par champ, avec le lisere vert
   de `marquerEcrit()`.

   Il ecrit et il reste, comme dans une fenetre de saisie en serie : une fiche de
   bien porte une dizaine de champs et trois cartes de chiffres derives, et on
   vient justement voir ce que la saisie a change. « Enregistrer et fermer »
   emportait l'ecran avant qu'on ait pu relire les comptes, et il fallait
   revenir. Le depart, lui, se fait par la navigation, qui ne perd rien.

   « Annuler » reste, et rend la fiche telle qu'elle etait au dernier point
   connu — l'ouverture, ou le dernier « Enregistrer ». */
/* La rangee de validation d'une fiche, au bas de la carte qui porte les champs.

   Elle appartient au formulaire qu'elle valide : c'est la qu'on vient de taper, et
   une rangee posee hors des cartes flotterait dans une page ou tout est encadre.
   Rassemblee avec Archiver et Cloturer-supprimer, elle formait un mur de quatre
   rectangles identiques sous un seul titre, sans ordre de lecture.

   `.fiche-actes` porte la geometrie, la meme pour toutes les rangees de boutons
   d'une fiche : les cartes ayant la meme largeur, les quatre boutons gardent leur
   taille et leur bord droit d'une carte a l'autre. `apres-champs` n'ajoute qu'un
   filet, parce que celle-ci ferme une carte au lieu de suivre son titre.

   Elle vient avant ce qui detruit : le doigt ne doit pas traverser le rouge pour
   atteindre « Enregistrer ». */
function barreValiderFiche(retour = 'accounts', dater = '', { parts = 0, credits = 0 } = {}) {
  /* `dater` nomme le montant que ce bouton verifie : 'solde' dans la carte du
     solde, 'bien' dans la carte « Mettre a jour » d'un bien. Sans lui, la barre
     enregistre et ne date rien (informations, notes).

     LE LIBELLE DIT CE QUE FAIT LE CLIC. Les chiffres sont deja ecrits a la
     frappe : "Enregistrer" laisserait croire le contraire. Sur un montant, le
     bouton le confirme et le date du jour, les credits du bien compris ; ailleurs
     il pose un point de retour, et "Enregistrer" dit alors vrai. "Annuler les
     modifications" rend toute la fiche a ce point de retour, et sa confirmation
     en dit la portee avant d'agir. */
  const libelle = dater === 'solde' ? (parts > 1 ? 'Confirmer les soldes' : 'Confirmer le solde')
    : dater === 'bien' ? (credits ? 'Confirmer la valeur et les crédits' : 'Confirmer la valeur')
    : 'Enregistrer';
  return `
    <div class="fiche-actes apres-champs">
      <button class="btn ghost" data-action="annuler-fiche"
              data-view="${esc(retour)}">${trad('Annuler les modifications')}</button>
      <button class="btn primary" data-action="enregistrer-fiche"${dater ? ` data-dater="${esc(dater)}"` : ''}>${trad(libelle)}</button>
    </div>`;
}

/* L'etat d'une fiche a son ouverture, pour pouvoir y revenir.

   « Annuler » ne peut pas vouloir dire « ne rien ecrire » : la fiche ecrit a
   chaque frappe, et c'est ce qui garantit qu'on ne perd jamais un montant en
   changeant d'ecran. La regle du projet est explicite la-dessus, avec sa raison :
   un bouton qui conditionne l'ecriture jette tout ce qu'on a tape si on quitte
   sans le voir.

   L'instantane se prend au premier rendu d'une route, pas a chaque rendu : la
   fiche se re-rend a chaque frappe de certains champs, et reprendre la photo a
   ce moment-la la rendrait toujours identique.

   Il couvre tout ce que la fiche peut ecrire, pas seulement l'objet qu'elle
   nomme : `instantaneFiche()` dans store.js en tient le perimetre. Il vit tant
   qu'on reste sur la fiche -- `render()` l'abandonne des qu'on la quitte, sinon
   un retour plus tard comparerait a une photo perimee, et « Annuler » ecraserait
   un solde mis a jour entre-temps depuis un autre ecran. */
let ficheAvant = null;

function memoriserFiche(cle) {
  if (!ficheAvant || ficheAvant.cle !== cle) ficheAvant = instantaneFiche(cle);
}

function ficheModifiee() {
  return ficheDiffere(ficheAvant);
}

function objetDeFiche(cle) {
  const [quoi, id] = String(cle).split(':');
  return quoi === 'compte' ? compteById(id) : etabById(id);
}

function retablirFiche() {
  return retablirInstantane(ficheAvant);
}

function cleFicheCourante(vue) {
  const r = routeParam();
  return r && (vue === 'ficheCompte' || vue === 'ficheEtab') ? `${r.genre}:${r.id}` : null;
}

const ACTES_QUI_GERENT_LA_FICHE = new Set(['annuler-fiche', 'enregistrer-fiche']);
async function suivreActeSurFiche(nom, faire) {
  if (!ficheAvant || ACTES_QUI_GERENT_LA_FICHE.has(nom)) return faire();
  const cle = ficheAvant.cle;
  const avant = JSON.stringify(instantaneFiche(cle));
  try {
    return await faire();
  } finally {
    if (ficheAvant && ficheAvant.cle === cle && JSON.stringify(instantaneFiche(cle)) !== avant) {
      ficheAvant = instantaneFiche(cle);
    }
  }
}

function viewFicheCompte(id) {
  const c = compteById(id);
  if (!c) return `<div class="card"><p class="empty">${trad('Ce compte n’existe plus.')}</p>
    <button class="btn" data-action="goto" data-view="accounts" data-anchor="">${trad('Retour aux actifs')}</button></div>`;
  const idx = Store.state.comptes.indexOf(c);
  const t = typeCompte(c.type);
  memoriserFiche(`compte:${c.id}`);
  const lignes = lignesDe(c);
  const seule = estActifTerminal(t) && !estBien(t) && lignes.length === 1
    ? lignes[0] : null;
  const carteSolde = !((t.sansCash || !t.classes.includes('liquidites')) && !(c.cash || []).length);
  const parClasse = new Map();
  for (const e of (c.cash || [])) parClasse.set('liquidites', (parClasse.get('liquidites') || 0) + num(e.montant));
  for (const l of lignes) parClasse.set(l.classe, (parClasse.get(l.classe) || 0) + l.valeur);

  return `
  <button type="button" class="btn sm ghost retour-page" data-action="goto" data-view="accounts" data-anchor="">‹ ${trad('Actifs')}</button>

  <div class="card cpt-entete">
    <div>
      <span class="hero-label">${majuscule(motCompte(t))}</span>
      <h2 class="fiche-nom">${esc(nomCompteV2(c))}</h2>
      ${c.statut === 'archive' ? '' : `<div class="cpt-net">${fmtEUR(valeurCompte(c))}</div>`}
      <span class="sub">${esc([sousTitreCompte(c, false), c.statut === 'archive' ? trad('archivé') : '']
        .filter(Boolean).join(' · '))}</span>
      ${c.statut === 'archive' ? '' : (() => {
        const dates = datesDuCompte(c).map(phraseDateValeur).filter(Boolean);
        return dates.length ? `<p class="hint date-valeur">${dates.join(' · ')}</p>` : '';
      })()}
      ${c.statut === 'archive' || !carteSolde || !(c.cash || []).length ? ''
        : `<button type="button" class="btn sm maj-solde" data-action="maj-solde">${trad('Mettre à jour le solde')}</button>`}
      ${(() => {
        const p = resteAVerser(c);
        if (!p) return '';
        return `
        <div class="plafond${p.plein ? ' plein' : ''}">
          <div class="plafond-jauge" aria-hidden="true">
            <i style="width:${p.part.toFixed(1)}%"></i>
          </div>
          <span class="sub">${p.plein
            ? `Plafond de ${fmtEUR0(p.plafond)} atteint`
            : trad('Il reste <b>{v}</b> à verser sur {p}').replace('{v}', fmtEUR0(p.reste)).replace('{p}', fmtEUR0(p.plafond))}</span>
        </div>`;
      })()}
      ${(() => {
        const et = c.etabId && etabById(c.etabId);
        if (!et) return '';
        const siens = COMPTES().filter(x => x.etabId === et.id);
        return `<button type="button" class="btn sm ghost lien-etab"
                data-action="fiche-etab" data-id="${esc(et.id)}"
                style="--teinte:${teinteEtab(et)}"
                title="${trad('Voir l’établissement qui tient ce compte')}">
          <span class="cpt-pastille" aria-hidden="true"></span>${esc(et.nom)} ›</button>`;
      })()}
    </div>
    <dl class="kv" style="margin-left:auto">
      ${[...parClasse.entries()].filter(([, v]) => v).map(([k, v]) =>
        `<dt>${esc(CLASSES_ACTIFS[k] || k)}</dt><dd>${fmtEUR(v)}</dd>`).join('')}
    </dl>
    ${(() => {
      const a = ancienneteCompte(c);
      if (!a) return '';
      const duree = `${a.annees} ${trad(a.annees > 1 ? 'ans' : 'an')}${
        /* « mois » est invariable en francais : la clef au pluriel porte un
           repli, sinon `trad()` rend la clef elle-meme et l'ecran affiche
           « 11 mois.pl ». Meme motif que `trad('sur.total', 'sur')`. */
        a.reste ? ` ${trad('et')} ${a.reste} ${trad(a.reste > 1 ? 'mois.pl' : 'mois', 'mois')}` : ''}`;
      return `<p class="hint" style="margin:12px 0 0">${trad('Ouvert depuis')} ${duree} · ${
        a.atteint
          ? `<b class="up">${trad('seuil des')} ${a.seuilAns} ${trad('ans atteint')}</b>`
          : `${trad('seuil des')} ${a.seuilAns} ${trad('ans le')} ${fmtDate(a.seuilLe)}`
      }${aide(trad('Un seuil fiscal, pas un délai : avant lui, l’argent reste accessible, au prix de l’avantage d’impôt et, pour un PEA, du plan lui-même. C’est pourquoi la disponibilité affichée plus bas n’en dépend pas.'))}</p>`;
    })()}
    ${t.retrait ? `<p class="hint cpt-retrait">${trad('Retraits')}${deuxPoints()} ${trad(t.retrait)}</p>` : ''}
    ${t.echeanceUnique && c.debloqueLe ? `<p class="hint cpt-retrait">${trad('Déblocage prévu le {d}, date que tu as déclarée.')
      .replace('{d}', esc(fmtDate(c.debloqueLe)))}</p>` : ''}
  </div>

  ${espaceBien(c, idx, t)}
  ${espaceTerminal(c, idx, t, seule)}

  ${!carteSolde ? '' : `
  <div class="card" data-anchor="solde">
    <div class="card-head"><h2>${BASES.liquidites.nom} ${trad('sur ce compte')}${aide(trad((c.cash || []).length
        ? 'Chaque chiffre s’enregistre dès la frappe. « Confirmer » date le solde du jour, même inchangé, et pose un point de retour. « Annuler les modifications » rend toute la fiche à ce point de retour, ou à son ouverture.'
        : 'Chaque chiffre s’enregistre dès la frappe. « Enregistrer » pose un point de retour. « Annuler les modifications » rend toute la fiche à ce point de retour, ou à son ouverture.')
        + ' ' + trad('Un compte joint se saisit comme tu le suis : ta part si chacun tient son tableau de bord, le solde entier pour suivre le foyer.'))}</h2>
      <button class="btn sm ghost" data-action="scinder-cash" data-id="${esc(c.id)}"
              title="${trad('Déclarer un second usage sur le même compte')}">${trad('Scinder')}</button>
    </div>
    ${(c.cash || []).length ? (c.cash || []).map((e, i) => `
      <div class="plc-ligne">
        <span class="cpt-nom">${trad('Liquidités')}${(() => {
          const verif = e.saisiLe ? trad('dernière vérification le {d}').replace('{d}', esc(fmtDate(e.saisiLe))) : '';
          if (aVerifier().some(x => x.chemin === `comptes.${idx}.cash.${i}.montant`))
            return `<span class="sub down">${trad(num(e.montant) < 0 ? 'solde négatif, à corriger' : 'valeur à vérifier')}${
              ` · ${verif || trad('solde jamais vérifié')}`}</span>`;
          const d = verif || trad('solde jamais vérifié');
          return d ? `<span class="sub">${d}</span>` : '';
        })()}</span>
        <select data-path="comptes.${idx}.cash.${i}.affectation" class="annee" title="${trad('À quoi sert cet argent ?')}">
          ${AFFECTATIONS.map(([v, l]) => `<option value="${v}" ${v === e.affectation ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        <input type="number" step="any" class="champ-inline" data-path="comptes.${idx}.cash.${i}.montant" value="${num(e.montant)}"${i ? '' : ' data-anchor-focus'}${
          aVerifier().some(x => x.chemin === `comptes.${idx}.cash.${i}.montant`) ? ' aria-invalid="true"' : ''}>
        <span class="champ-unite" aria-hidden="true">${signeDeviseBase()}</span>
        ${t.interne && (c.cash || []).length < 2 ? ''
          : `<button class="btn sm ghost danger" data-action="retirer-cash" data-id="${esc(c.id)}" data-i="${i}" title="${trad('Retirer cette part')}">${trad('Retirer')}</button>`}
      </div>`).join('')
    : `<p class="empty">${t.titres
        ? trad('Aucune espèce en attente. « Scinder » déclare un montant à investir.')
        : trad('Pas d’argent déclaré sur ce compte. « Scinder » ajoute une première part.')}</p>`}
    ${barreValiderFiche('accounts', (c.cash || []).length ? 'solde' : '', { parts: (c.cash || []).length })}
  </div>`}

  ${estBien(t) || seule || (!t.classes.some(x => x !== 'liquidites') && !lignes.length) ? '' : `
  <div class="card"${valeurDeReleve(t) ? ' data-anchor="estimation"' : ''}>
    <div class="card-head"><h2>${trad(t.melange ? (t.contenant === 'banque' ? 'Supports du plan' : 'Supports du contrat')
      : t.titres ? 'Lignes de titres' : 'Placements détenus')}</h2>
      <span class="hint">${trad('Disponibilité')}${aide(trad("Sous combien de temps chaque placement redevient de l’argent disponible : le délai de vente de l’actif, en séance pour un titre coté, des semaines ou des mois pour un bien ou un non coté. L’enveloppe ne l’allonge que si elle bloque vraiment l’argent, comme un PER jusqu’à la retraite ; les règles de retrait d’un PEA ou d’une assurance-vie changent l’impôt, pas ce délai, et se lisent en tête de fiche. Elle alimente la carte « Réserve de sécurité » de l’accueil. « Auto » suit ces règles, et chaque ligne peut les contredire : un non coté peut se revendre sur un marché secondaire."))}</span>
      ${t.titres ? `<button class="btn sm ghost" data-action="ajouter-ligne" data-compte="${esc(c.id)}"
                   title="${trad('Chercher un titre coté et le poser sur ce compte')}">${trad('+ Titre coté')}</button>` : ''}
      ${!t.titres || t.melange ? `<button class="btn sm ghost" data-action="ajouter-placement" data-id="${esc(c.id)}"
                   title="${trad('Ajouter un placement à ce compte')}">${trad('+ Placement')}</button>` : ''}
    </div>
    ${lignes.length ? `<p class="hint" style="margin:0 0 8px">${trad(t.titres
      ? 'Touche une ligne pour la modifier ou la vendre.' : 'Touche une ligne pour la modifier.')}</p>` : ''}
    ${lignes.length ? lignes.map(l => lignePlacement(l, c, true)).join('')
      : `<div class="empty">
          <p style="margin:0 0 12px">${trad('Aucun placement pour l’instant.')} ${trad(t.melange
            ? (t.contenant === 'banque'
              ? 'Un plan porte ce qu’il propose : un fonds qui cote, un fonds stable qui ne cote nulle part. Les deux boutons ci-dessus mènent chacun à l’un des deux.'
              : 'Un contrat porte ce qu’il propose : un ETF qui cote, un fonds euros qui ne cote nulle part, une SCPI. Les deux boutons ci-dessus mènent chacun à l’un des deux.')
            : t.titres
            ? 'Les lignes se créent dans l’onglet Marchés, rattachées à ce compte.'
            : 'Un prêt participatif, une part de société, un projet : chacun sa ligne, avec son échéance.')}</p>
          ${t.titres && !t.melange ? '' : `<button class="btn sm" data-action="ajouter-placement" data-id="${esc(c.id)}"
                   >${trad('+ Ajouter un placement')}</button>`}
        </div>`}
  </div>`}

  ${(() => {
    /* Le financement, sur toute fiche de compte et non plus seulement sur celle
       d'un bien.

       Un courtier qui prete sur marge se declare comme un credit, et le seul endroit ou on pouvait le saisir etait la fiche de
       l'etablissement, un etage au-dessus. Or la question se pose en regardant le
       compte qui porte les titres achetes avec cet argent : c'est la qu'on vient
       la poser, et il n'y avait rien. Un bien immobilier, lui, avait sa carte
       depuis le debut, par `espaceBien()`.

       La dette reste rangee sur l'etablissement, elle n'est pas recopiee ici : le
       bouton ecrit au meme endroit que la fiche du dessus, et le sous-titre nomme
       l'etablissement pour qu'on ne croie pas qu'elle appartient a ce compte-la.
       Un etablissement qui tient deux comptes montre donc le meme credit sur les
       deux fiches — c'est une lecture, et elle dit d'ou elle vient. */
    if (estBien(t) || !c.etabId) return '';
    const { etab, dettes, total } = creditsDuCompte(c);
    if (!etab) return '';
    if (!dettes.length && !t.pretSurTitres) return '';
    const valeur = valeurCompte(c);
    return `
  <div class="card">
    <div class="card-head"><h2>${trad('Financement')}${aide(t.pretSurTitres
      ? trad("Ce que cet établissement te prête : une marge de courtier, un prêt sur titres, une avance. Les placements achetés avec cet argent restent comptés en entier dans tes avoirs, puisque tu les possèdes, et le montant prêté se retranche de ton patrimoine net. Ne le note pas en liquidités négatives sur le compte : il compterait deux fois, et aucun écran ne le dirait. Le crédit appartient à l’établissement, pas à ce compte : s’il en tient plusieurs, il n’est déduit qu’une fois du patrimoine.")
      : trad("Ce que cet établissement te prête. Le montant se retranche de ton patrimoine net ; le crédit appartient à l’établissement, pas à ce compte : s’il en tient plusieurs, il n’est déduit qu’une fois."))}</h2>
      <span class="hint">${dettes.length
        ? `${trad('chez')} ${esc(etab.nom)}, ${trad('pour tous ses comptes')}`
        : trad('marge, prêt sur titres, avance')}</span>
      <button class="btn sm ghost" data-action="ajouter-credit" data-id="${esc(c.etabId)}">${trad('+ Crédit')}</button></div>
    ${!dettes.length ? `
    <p class="small muted" style="margin:0">${trad('Aucun crédit chez')} ${esc(etab.nom)}.
      ${trad('Si ce courtier te prête, sur marge par exemple, déclare-le ici.')}</p>`
    : `<div class="mlist-groupe">${dettes.map(({ d, i }) => `
      <button type="button" class="mlist" data-action="editer-credit"
              data-etab="${esc(etab.id)}" data-i="${i}" title="${trad('Modifier ce crédit')}">
        <span class="ml-nom">${esc(d.libelle || 'Crédit')}
          <span class="sub">${esc([d.preteur, d.taux ? `${fmtNombre(num(d.taux))} % l’an` : '',
            d.mensualite ? `${fmtEUR0(num(d.mensualite))} par mois` : ''].filter(Boolean).join(' · ')
            || 'capital restant dû')}</span></span>
        <span class="ml-chiffres"><b class="dette">−${fmtEUR(num(d.montant))}</b></span>
        <span class="ml-chev" aria-hidden="true">›</span>
      </button>`).join('')}</div>
    ${!t.pretSurTitres ? '' : `<dl class="kv" style="margin-top:12px">
      <dt>${trad('Valeur du')} ${motCompte(t)}</dt><dd>${fmtEUR(valeur)}</dd>
      <dt>${trad('Crédits chez')} ${esc(etab.nom)}</dt><dd class="dette">−${fmtEUR(total)}</dd>
      <dt><b>${trad('Ce que tu possèdes')}</b>${aide(trad("La valeur du compte moins ce que tu dois à cet établissement. C’est ce montant qui compte dans ton patrimoine net. Si l’établissement tient plusieurs comptes, le crédit est déduit une seule fois du patrimoine, pas une fois par compte."))}</dt>
      <dd class="${valeur - total < 0 ? 'dette' : ''}"><b>${fmtEUR(valeur - total)}</b></dd>
      ${valeur - total > 0.005 ? `<dt>${trad('Effet de levier')}${aide(trad("Ce que tu contrôles rapporté à ce qui est vraiment à toi sur ce compte. À 150 %, une baisse de 10 % des titres coûte 15 % de tes capitaux propres. Ce chiffre ne dit rien de la marge d’appel : l’application ne connaît pas les règles de ton courtier."))}</dt>
        <dd>${fmtPct(valeur / (valeur - total) * 100, 0)}
          <span class="muted">${trad('de tes capitaux propres')}</span></dd>` : ''}
    </dl>`}
    <button class="btn sm ghost" data-action="fiche-etab" data-id="${esc(etab.id)}"
            style="margin-top:12px">${trad('Fiche')} ${esc(etab.nom)} ›</button>`}
  </div>`;
  })()}

  <div class="card">
      <div class="card-head"><h2>${trad('Informations')}${aide(trad('Le nom, le type, l’établissement et les dates du compte. Le solde et les placements se changent dans leurs cartes.'))}</h2>
        <button class="btn sm ghost" data-action="modifier-compte" data-id="${esc(c.id)}">${trad('Modifier')}</button></div>
      <dl class="kv">
        <dt>${trad('Nom du')} ${motCompte(t)}</dt><dd>${c.libelle ? esc(c.libelle)
          : `<span class="muted">${trad('non renseigné')}</span>`}</dd>
        <dt>${trad('Type de')} ${motCompte(t)}${aide(t.interne
          ? trad('Les espèces n’ont pas d’établissement : personne ne les tient pour '
          + 'toi. Ce compte existe une fois, il ne se choisit pas dans la liste '
          + 'et ne se supprime pas. S’il n’y a plus de billets, mets-le à 0.')
          : trad('Il commande la poche du patrimoine, les classes que le compte peut '
          + 'porter et la disponibilité de ce qu’il contient. On peut le corriger '
          + 'à tout moment : l’historique des relevés suit le compte, il ne se '
          + 'perd pas. Un changement qui laisserait un placement sans place est '
          + 'refusé, en disant lequel déplacer. '
          + 'Non coté : trois types. « Parts de société » pour du '
          + 'private equity, des parts de société ou un pacte d’associés : on '
          + 'sort au rachat, pas à une date. « Fonds non coté » pour un fonds qui publie '
          + 'sa valeur liquidative. « Prêt participatif » pour un prêt à un taux, '
          + 'avec une échéance et un état : ces lignes-là portent une date de '
          + 'remboursement, et l’application te rappelle celles qui l’ont dépassée.'))}</dt>
        <dd>${esc(trad(t.label))}${t.interne ? trad(', sans établissement') : ''}</dd>
        ${t.id === 'livret' ? `
        <dt>${trad('Plafond de versement')}${aide(trad("Facultatif. Une fois posé, la fiche dit ce qu’il reste à verser. Les plafonds courants : 22 950 € pour un Livret A, 12 000 € pour un LDDS, 10 000 € pour un LEP. Les intérêts peuvent faire dépasser le plafond, c’est normal et la fiche l’annonce alors comme plein."))}</dt>
        <dd>${num(c.plafond) ? fmtEUR(c.plafond)
              : `<span class="muted">${trad('non renseigné')}</span>`}</dd>` : ''}
        ${t.dateSensible ? `
        <dt>${trad('Date d’ouverture')}${aide(trad("Elle donne l’ancienneté du contrat, affichée en tête de cette fiche : cinq ans pour un PEA, huit pour une assurance-vie. Ce sont des seuils d’impôt, pas des délais : avant eux, l’argent reste accessible, au prix de l’avantage fiscal et, pour un PEA, du plan lui-même. C’est pour cela qu’elle est demandée ici et pas sur les autres types de compte."))}</dt>
        <dd>${c.ouvertLe ? esc(fmtDate(c.ouvertLe))
              : `<span class="muted">${trad('à renseigner')}</span>`}</dd>`
        : (c.ouvertLe || estActifTerminal(t))
          ? `<dt>${motDateCompte(t)}</dt><dd>${c.ouvertLe ? esc(fmtDate(c.ouvertLe))
              : `<span class="muted">${trad('à renseigner')}</span>`}</dd>` : ''}
        ${t.echeanceUnique ? `<dt>${trad('Déblocage prévu')}${aide(trad('Une date que tu déclares, ta retraite en général. Elle se lit en tête de fiche ; aucun calcul ne la déduit ni ne la suppose.'))}</dt>
        <dd>${c.debloqueLe ? esc(fmtDate(c.debloqueLe)) : `<span class="muted">${trad('non renseigné')}</span>`}</dd>` : ''}
        ${c.statut === 'archive' ? `<dt>${trad('Date de clôture')}</dt>
        <dd>${c.clotureLe ? esc(fmtDate(c.clotureLe))
              : `<span class="muted">${trad('non renseignée')}</span>`}</dd>` : ''}
        ${!t.interne && c.numero ? `<dt>${trad('Numéro de compte')}</dt><dd>${esc(c.numero)}${boutonCopier(c.numero, 'Copier le numéro de compte')}</dd>` : ''}
      </dl>
      <div class="field" style="margin-top:12px"><label>${trad('Notes')}</label>
        <input data-path="comptes.${idx}.notes" value="${esc(c.notes || '')}"
               placeholder="${trad('facultatif')}" style="text-align:left"></div>
      ${carteSolde || estBien(t) ? '' : barreValiderFiche()}
    </div>
    ${t.interne && c.statut !== 'archive' ? '' : `<div class="card">
      <div class="card-head"><h2>${trad('actions.fiche', 'Actions')}</h2></div>
      <div class="fiche-actes${c.statut !== 'archive' && estImmoEnDirect(t) ? ' trois' : ''}">
        ${c.statut !== 'archive' && estImmoEnDirect(t)
          ? `<button class="btn ghost" data-action="vendre-bien" data-id="${esc(c.id)}">${trad('Vendre ce bien')}</button>` : ''}
        ${c.statut === 'archive'
          ? `<button class="btn ghost" data-action="restaurer-compte" data-id="${esc(c.id)}">${trad('Restaurer')}</button>`
          : `<button class="btn ghost" data-action="archiver-compte" data-id="${esc(c.id)}">${trad('Archiver')}</button>`}
        ${t.interne ? '' : `<button class="btn ghost danger" data-action="supprimer-compte" data-id="${esc(c.id)}">${trad('Supprimer')}</button>`}
      </div>
      <p class="small muted" style="margin:12px 0 0">
        ${t.interne
          ? trad('Restaurer remet ces espèces dans tes totaux. Elles ne s’archivent plus : s’il n’y a plus de billets, mets leur montant à 0.')
          : `${c.statut !== 'archive' && estImmoEnDirect(t)
              ? `${trad(creditsDuBien(c).length ? 'Vendre enregistre le prix, solde ses crédits et garde la vente au journal.'
                                                : 'Vendre enregistre le prix et garde la vente au journal.')} ` : ''}${
            trad('Archiver conserve l’historique et sort le compte de tous les totaux. '
          + 'Supprimer efface aussi ses montants des vues. Les relevés passés restent lisibles.')}`}
      </p>
    </div>`}`;
}

function viewFicheEtab(id) {
  const e = etabById(id);
  if (!e) return `<div class="card"><p class="empty">${trad('Cet établissement n’existe plus.')}</p>
    <button class="btn" data-action="goto" data-view="accounts" data-anchor="">${trad('Retour aux actifs')}</button></div>`;
  const idx = Store.state.etabs.indexOf(e);
  memoriserFiche(`etab:${e.id}`);
  const siens = COMPTES().filter(c => c.etabId === e.id && c.statut !== 'archive');
  const total = siens.reduce((s, c) => s + valeurCompte(c), 0);
  const credits = (e.dettes || []).reduce((s, d) => s + num(d.montant), 0);

  return `
  <button type="button" class="btn sm ghost retour-page" data-action="goto" data-view="accounts" data-anchor="">‹ ${trad('Actifs')}</button>

  <div class="card cpt-entete" style="--teinte:${teinteEtab(e)}">
    <div>
      <span class="hero-label">${esc(trad(contenantDeLEtab(e.id).titre))}</span>
      <h2 class="fiche-nom"><span class="cpt-pastille" aria-hidden="true"></span>${esc(e.nom)}</h2>
      <div class="cpt-net">${fmtEUR(total - credits)}</div>
      <span class="sub">${siens.length} ${motContenu(e.id, siens.length)}${credits ? ` · ${fmtEUR0(credits)} ${trad('de crédits')}` : ''}</span>
    </div>
    <button class="btn sm ghost" style="margin-left:auto"
            data-action="modifier-etab" data-id="${esc(e.id)}">${trad('Modifier')}</button>
  </div>

  ${(() => {
    const p = perfEtab(e.id);
    if (!p) return '';
    return `
  <div class="card">
    <div class="card-head"><h2>${trad('Investi et plus-value')}</h2>
      <span class="hint">${trad('sur les lignes dont le prix de revient est saisi')}</span></div>
    <dl class="kv">
      <dt>${trad('Montant investi')}</dt><dd>${fmtEUR(p.investi)}</dd>
      <dt>${trad('Valeur actuelle')}</dt><dd>${fmtEUR(p.valeur)}</dd>
      <dt><b>${trad('Plus-value latente')}${aide(trad('La valeur d’aujourd’hui moins ce que tu as payé, sur les seules lignes dont le prix de revient est saisi. Latente : elle n’est encaissée qu’à la revente, et aucun impôt n’en est déduit.'))}</b></dt>
        <dd><b class="${cls(p.pnl)}">${fmtSigned(p.pnl)}</b>${p.pct == null ? ''
          : ` <span class="muted">·</span> <span class="${cls(p.pnl)}">${fmtSignedPct(p.pct)}</span>`}</dd>
    </dl>
    ${p.horsBase < 0.005 ? '' : `<p class="hint" style="margin:8px 0 0">${
      p.sansBase < 0.005
        ? trad('{v} hors de ce calcul : du cash, qui n’a pas de prix de revient').replace('{v}', fmtEUR0(p.horsBase))
        : p.cash < 0.005
        ? trad('{v} hors de ce calcul : des lignes sans prix de revient saisi').replace('{v}', fmtEUR0(p.horsBase))
        : trad('{v} hors de ce calcul : {c} de cash et {l} de lignes sans prix de revient saisi')
            .replace('{v}', fmtEUR0(p.horsBase)).replace('{c}', fmtEUR0(p.cash)).replace('{l}', fmtEUR0(p.sansBase))}</p>`}
  </div>`;
  })()}

  <div class="card">
    <div class="card-head"><h2>${majuscule(motContenu(e.id, 2))}</h2>
      <button class="btn sm ghost" data-action="ajouter-compte" data-etab="${esc(e.id)}"
              title="${trad('Ajouter un')} ${motContenu(e.id, 1)} ${trad('chez')} ${esc(e.nom)}"
              >+ ${majuscule(motContenu(e.id, 1))}</button></div>
    ${siens.length ? siens.map(c => ligneCompte(c, false)).join('')
      : `<div class="empty">
          <p style="margin:0 0 12px">${trad('Aucun compte ici pour l’instant.')}</p>
          <button class="btn sm" data-action="ajouter-compte" data-etab="${esc(e.id)}"
            >+ ${trad('Ajouter un')} ${motContenu(e.id, 1)} ${trad('chez')} ${esc(e.nom)}</button>
        </div>`}
  </div>

  <div class="card" data-anchor="credit">
    <div class="card-head"><h2>${trad('Crédits en cours')}${aide(trad("Un crédit pèse en négatif sur le patrimoine net : patrimoine net = total de tes avoirs moins tes crédits."))}</h2>
      <button class="btn sm ghost" data-action="ajouter-credit" data-id="${esc(e.id)}">${trad('+ Crédit')}</button></div>
    ${(e.dettes || []).length ? e.dettes.map((d, i) => `
      <div class="plc-ligne">
        <input data-path="etabs.${idx}.dettes.${i}.libelle" value="${esc(d.libelle)}" style="text-align:left; max-width:14em">
        <span class="spacer"></span>
        <input type="number" step="any" class="champ-inline" data-path="etabs.${idx}.dettes.${i}.montant" value="${num(d.montant)}"${i ? '' : ' data-anchor-focus'}>
        <button class="btn sm danger" data-action="retirer-credit"
                data-id="${esc(e.id)}" data-i="${i}">${trad('Supprimer')}</button>
      </div>`).join('') + `
      <p class="small muted" style="margin:12px 0 0">
        ${trad('Après chaque mensualité, baisse le capital restant dû : ton patrimoine net '
          + 'monte d’autant, sans que la valeur du bien change.')}
      </p>`
    : `<p class="empty">${trad('Aucun crédit déclaré chez')} ${esc(e.nom)}.</p>`}
  </div>

  <div class="card">
    <div class="card-head"><h2>${trad('Notes')}</h2></div>
    <input data-path="etabs.${idx}.notes" value="${esc(e.notes || '')}" placeholder="${trad('facultatif')}" style="text-align:left">
    ${barreValiderFiche()}
  </div>`;
}

/* Glisser une ligne vers la gauche révèle Modifier / Archiver.

   Le geste ne s'engage qu'une fois le sens décidé — sinon un défilement
   vertical du doigt entraînait la ligne de quelques pixels sur le côté, et
   toute la liste tremblait pendant qu'on la parcourait.

   La position se pose dans une trame d'animation, pas à chaque événement
   tactile : un doigt émet jusqu'à 120 événements par seconde là où l'écran
   n'en affiche que 60 ou 120. Écrire deux fois la même trame ne se voit pas,
   mais coûte deux recalculs de style — et c'est ce qui donne la sensation de
   caoutchouc. `translate3d` garde la ligne sur sa propre couche.

   La course s'amortit en fin de trajet : passé la butée, le doigt continue et
   la ligne ne suit plus qu'au tiers. Rien ne bloque net, ce qui est la
   différence entre un geste qui répond et un geste qui bute. */
function monteSwipeComptes() {
  const BUTEE = 132, DECLENCHE = 60;
  for (const bloc of $$('.cpt-swipe')) {
    const ligne = bloc.querySelector('.cpt-ligne');
    let x0 = null, y0 = 0, dx = 0, sens = null, trame = 0;
    let origine = 0, finDeRetour = null;
    const position = () => Math.min(0, origine + dx);

    const poser = () => {
      trame = 0;
      const x = position();
      const d = x < -BUTEE ? -BUTEE + (x + BUTEE) / 3 : x;
      ligne.style.transform = `translate3d(${d}px, 0, 0)`;
    };

    ligne.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
      dx = 0; sens = null;
      const t = getComputedStyle(ligne).transform;
      origine = t && t !== 'none' ? new DOMMatrixReadOnly(t).m41 : 0;
      if (finDeRetour) finDeRetour();
      ligne.style.transition = 'none';
      ligne.style.transform = origine ? `translate3d(${origine}px, 0, 0)` : '';
      ligne.style.willChange = 'transform';
    }, { passive: true });

    ligne.addEventListener('touchmove', e => {
      if (x0 === null) return;
      const ex = e.touches[0].clientX - x0, ey = e.touches[0].clientY - y0;
      if (sens === null) {
        if (Math.abs(ex) < 6 && Math.abs(ey) < 6) return;
        sens = Math.abs(ex) > Math.abs(ey) ? 'lateral' : 'vertical';
      }
      if (sens === 'vertical') return;             // on défile, la ligne ne bouge pas
      dx = ex;
      if (!trame) trame = requestAnimationFrame(poser);
    }, { passive: true });

    const fin = () => {
      if (x0 === null) return;
      if (trame) { cancelAnimationFrame(trame); trame = 0; }
      const ouvre = sens === 'lateral' && position() < -DECLENCHE;
      /* Une courbe qui décélère, pas un `ease` symétrique : le mouvement part
         vite et se pose, comme un objet qu'on lâche. */
      ligne.style.transition = 'transform .22s cubic-bezier(.22,.61,.36,1)';
      ligne.style.transform = ouvre ? `translate3d(${-BUTEE}px, 0, 0)` : '';
      bloc.classList.toggle('ouvert', ouvre);
      finDeRetour = nettoyerApres(ligne, 300, () => { finDeRetour = null; });
      x0 = null; dx = 0; sens = null;
    };
    ligne.addEventListener('touchend', fin);
    ligne.addEventListener('touchcancel', fin);
  }
}

function viewStrategy() {
  const st = Store.state.strategy;
  const capital = Store.state.meta.modelCapital;
  let cum = 0;
  const thr = st.thresholds.map(t => {
    const amount = st.reserveMonthly * t.pct / 100;
    cum += amount;
    return `<tr><td class="name">${esc(t.label)}</td><td>${fmtPct(t.pct, 0)}</td>
      <td>${fmtEUR0(amount)}</td><td class="muted">${fmtEUR0(cum)}</td></tr>`;
  }).join('');

  return `
  <div class="card">
    <div class="card-head"><h2>${trad('Règle d\'achat')}</h2></div>
    <input data-path="strategy.rule" value="${esc(st.rule)}" style="text-align:left">
  </div>

  <div class="grid g-2-1">
    <div class="card">
      <div class="card-head"><h2>${trad('Déploiement par seuil')}</h2>
        <span class="hint">${trad('Réserve tactique de {v}').replace('{v}', fmtEUR0(st.reserveMonthly))} ${trad('/ mois')}</span></div>
      <table>
        <thead><tr><th>${trad('Seuil')}</th><th>${trad('% de la réserve')}</th><th>${trad('À déployer')}</th><th>${trad('Cumul si tout déclenché')}</th></tr></thead>
        <tbody>${thr}</tbody>
        <tfoot><tr><td>${trad('Total')}</td><td>${fmtPct(st.thresholds.reduce((s, t) => s + t.pct, 0), 0)}</td>
          <td>${fmtEUR0(cum)}</td><td></td></tr></tfoot>
      </table>
    </div>
    <div class="card">
      <div class="card-head"><h2>${trad('Réserve tactique')}</h2></div>
      <div class="field"><label>${trad('Épargne mensuelle ({dev})')}${aide(trad('Le montant que tu places chaque mois, saisi à la main. Il sert de base au partage ci-dessous, et il est indépendant de la capacité d’épargne que Budget calcule.'))}</label>
        <input type="number" step="50" data-path="strategy.reserveBase" value="${st.reserveBase}"></div>
      <div class="field" style="margin-top:12px"><label>${trad('Part réservée au tactique (%)')}</label>
        <input type="number" step="5" data-path="strategy.reservePct" value="${st.reservePct}"></div>
      <div class="field" style="margin-top:12px"><label>${trad('Réserve mensuelle ({dev})')}</label>
        <input type="number" step="50" data-path="strategy.reserveMonthly" value="${st.reserveMonthly}"></div>
      <p class="small muted" style="margin:12px 0 0">
        ${fmtPct(st.reservePct, 0)} de ${fmtEUR0(st.reserveBase)} = ${fmtEUR0(st.reserveBase * st.reservePct / 100)}.
      </p>
    </div>
  </div>

  <div class="card">
    <div class="card-head"><h2>${trad('Modèles d\'allocation')}</h2>
      <div class="row"><span class="hint">${trad('Base de calcul')}</span>
        <input type="number" step="1000" data-path="meta.modelCapital" value="${capital}" style="max-width:130px"></div></div>
    <div class="grid g-2">
      ${st.models.map((m, mi) => `
        <div>
          <h3 style="margin:0 0 4px;font-size:var(--font-base)">${trad('Allocation {n}, {nom}').replace('{n}', mi + 1).replace('{nom}', esc(m.name))}</h3>
          <p class="small muted" style="margin:0 0 12px">${esc(m.note || '')}</p>
          <table>
            <thead><tr><th>${trad('Classe d\'actif')}</th><th>%</th><th>${trad('Montant')}</th><th style="text-align:left">${trad('Véhicules')}</th></tr></thead>
            <tbody>${m.lines.map(l => `<tr>
              <td class="name">${esc(l.label)}</td>
              <td>${fmtPct(l.pct, 0)}</td>
              <td>${fmtEUR0(capital * l.pct / 100)}</td>
              <td style="text-align:left" class="muted small">${esc(l.vehicles)}</td>
            </tr>`).join('')}</tbody>
            <tfoot><tr><td>${trad('Total')}</td><td>${fmtPct(m.lines.reduce((s, l) => s + l.pct, 0), 0)}</td>
              <td>${fmtEUR0(capital)}</td><td></td></tr></tfoot>
          </table>
        </div>`).join('')}
    </div>
  </div>`;
}

let budgetYear = null;   // null = l'année en cours
/* Tri du detail mensuel : { key, dir }, ou null pour l'ordre du calendrier.
   `key` vaut 'mois', 'total', ou le nom d'une categorie. Il ne trie que le
   tableau du grand ecran — la liste de telephone reste chronologique, elle
   n'a pas d'en-tetes pour dire son ordre, et un ordre muet est un piege. */
let depSort = null;

function budgetAnnee() {
  const annees = expenseYears();
  const courante = todayISO().slice(0, 4);
  /* « Toutes les années » a quitte le selecteur de Budget : une valeur `all`
     restee d'avant (ou posee par un vieux geste) retombe sur l'annee en
     cours, sans quoi la page afficherait un choix que le menu n'offre plus. */
  if (budgetYear === 'all') budgetYear = null;
  return budgetYear ?? (annees.includes(courante) ? courante : annees[annees.length - 1]);
}

const viewBudgetCadre = () => viewBudget('cadre');

/* LA BRIQUE DU MOIS AVANT LA PREMIERE DEPENSE.

   Sur un profil vierge, l'onglet ouvrait sur « 0 € », puis « Objectif mensuel
   0 € », « Reste sur l'objectif 0 € », « Moyenne 2026 0 € » : quatre nombres
   qui disent tous la meme chose — rien n'est saisi — et qui font croire a un
   tableau casse plutot qu'a un produit qui accompagne. Les tuiles et le
   graphique avaient deja leur garde, `aDesDepensesSaisies()` ; la brique la
   recoit, et fait ce que font les autres etats vides de l'application : dire
   ce que la section permet, et tendre le geste qui la remplit. Un objectif
   deja regle se lit ; sinon on propose de le regler, jamais « 0 € ». */
function briqueDepensesVide(f) {
  return `
    <div class="card">
      <p class="empty" style="margin:0 0 4px">${trad('Suis ce que tu dépenses chaque mois. Saisis un premier mois pour découvrir ta moyenne mensuelle et ce qu’il te reste réellement.')}</p>
      <button type="button" class="btn sm" data-action="saisir-mois-courant" style="margin:4px 0 0">${trad('Saisir les dépenses du mois')}</button>
      <button type="button" class="btn sm ghost" data-action="importer-tableau" data-cible="depenses"
              style="margin:4px 0 0">${trad('Importer l’export de ta banque')}</button>
      <p class="small muted" style="margin:12px 0 0">${f.target > 0
        ? `${trad('Objectif mensuel')} : ${fmtEUR0(f.target)} · `
        : ''}<button type="button" class="lien-nu" data-action="regler-objectif-depenses">${trad('Régler un objectif mensuel')}</button></p>
    </div>`;
}

function viewBudget(section = 'depenses') {
  const cadre = section === 'cadre';
  const f = budgetFrame();
  const years = expenseYears();
  const year = budgetAnnee();
  const stats = expenseYearStats(year);
  const cats = expenseByCategory(year);
  const lignesDepenses = Store.state.budget.expenses
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => year === 'all' || String(r.month).startsWith(year));
  const cur = currentExpenseMonth();
  /* `savingsReconciliation()` etait lu ici, pour la carte « Epargne et
     croissance » qui a rejoint l'accueil. Elle en etait le seul lecteur de cette
     vue : la ligne est partie avec elle, sans quoi c'etait un appel dont plus
     personne ne se servait — la moitie qu'on oublie en retirant un affichage. */
  const b = Store.state.budget;

  const resteObjectif = f.target - (cur ? cur.total : 0);
  const attendu = depensesEnAttente();

  return `
  ${cadre ? '' : `
  <div class="grid g-hero budget-duo">
    <div class="duo-col">
    ${aDesDepensesSaisies() ? `
    <div class="hero card-cliquable">
      <button type="button" class="card-couvre" data-action="saisir-mois-courant"
              aria-label="${trad('Saisir les dépenses du mois')}"
              title="${trad('Saisir les dépenses du mois')}"></button>
      <div>
        <div class="hero-label">${cur ? (cur.isCurrent ? trad('Dépenses du mois en cours') : `${trad('Dernier mois renseigné')} · ${esc(cur.label)}`) : trad('Dépenses')}
          <button type="button" class="btn sm ghost import-lien" data-action="importer-tableau" data-cible="depenses"
                  title="${esc(trad('Importer l’export de ta banque'))}">${trad('Importer')}</button></div>
        <div class="hero-value">${cur ? fmtEUR0(cur.total) : ''}</div>
      </div>
      <div class="hero-deltas">
        <button type="button" class="hero-delta hero-delta-reglable"
                data-action="regler-objectif-depenses"
                aria-label="${trad('Régler l’objectif de dépenses mensuel,')} ${fmtEUR0Texte(f.target)}">
          <span>${trad('Objectif mensuel')}</span>
          <b>${fmtEUR0(f.target)}<span class="hero-delta-chev" aria-hidden="true">›</span></b>
        </button>
        <div class="hero-delta">
          <span>${resteObjectif >= 0 ? trad('Reste sur l’objectif') : trad('Dépassement')}</span>
          <b class="${resteObjectif >= 0 ? '' : classeDepassement(cur ? cur.total : 0, f.target)}"
            >${fmtEUR0(Math.abs(resteObjectif))}</b>
        </div>
        ${cur && f.target > 0 ? `
        <div class="hero-delta">
          <span>${trad('Budget consommé')}</span>
          <b class="${classeDepassement(cur.total, f.target)}">${fmtPct(cur.total / f.target * 100, 0)}</b>
        </div>` : ''}
      </div>
      ${cur && cur.note ? `<p class="small muted" style="margin:0">${esc(cur.note)}</p>` : ''}
      ${(() => {
        const ligne = cur && Store.state.budget.expenses.find(r => r.month === cur.month);
        const parts = Object.entries((ligne && ligne.v) || {})
          .map(([nom, v]) => ({ nom, v: num(v) }))
          .filter(x => x.v > 0)
          .sort((a, b2) => b2.v - a.v);
        if (!parts.length) {
          return `<p class="small muted" style="margin:0">
            ${trad('Aucune dépense saisie')}${cur ? ` ${trad('pour')} ${esc(cur.label)}` : ''}. ${trad('Touche cette carte pour les entrer.')}</p>`;
        }
        const haut = parts[0].v;
        return `<div class="flow">
          ${parts.slice(0, 6).map(p => `
            <div class="flow-row">
              <span class="flow-label">${esc(p.nom)}</span>
              <div class="flow-bar"><div style="width:${Math.max(2, p.v / haut * 100)}%;
                background:var(--degrade-budget)"></div></div>
              <b class="flow-val">${fmtEUR0(p.v)}</b>
            </div>`).join('')}
          ${parts.length > 6 ? `<p class="small muted" style="margin:4px 0 0">
            ${trad(parts.length - 6 > 1 ? 'et {n} autres catégories' : 'et {n} autre catégorie')
              .replace('{n}', parts.length - 6)}</p>` : ''}
        </div>`;
      })()}
    </div>
` : briqueDepensesVide(f)}

    <div class="card">
      <div class="card-head"><h2>${trad('Où va ce que tu gagnes')}</h2><span class="hint">${trad('chaque mois')}</span></div>
      ${(() => {
        const parts = [
          [trad('Charges fixes'), f.fixed, 'var(--series-2)', f.fixedPct, 'ancre'],
          [trad('Objectif dépenses'), f.target, 'var(--series-4)', f.targetPct, 'objectif'],
          /* L'aide vit dans sa propre case, et non collee au libelle : celui-ci
             sert aussi a l'etiquette d'accessibilite de la barre, ou un
             `<span>` se lirait a voix haute. */
          [trad('Objectif d’investissement'), f.investTarget, 'var(--series-1)',
            f.investTargetPct, '', trad('Revenus moins charges fixes moins ton objectif de '
            + 'dépenses. C’est le montant que tu vises, là où la capacité d’épargne est ce '
            + 'que tes dépenses réelles laissent.')],
        ];
        /* Le motif vient de `PREMIERS_PAS` : il est ne ici, et les deux autres
           invites le reprennent depuis la meme table plutot que de le recopier. */
        if (!f.income) return invitePremierPas('revenus', { secondaire: true });
        if (chargesInconnues()) return `
        <button type="button" class="flux-total" data-action="toggle-revenus"
                title="${trad('Voir et modifier les sources de revenus')}">
          <b>${revenuEstime() ? '≈ ' : ''}${fmtEUR0(f.income)}</b>
          <span class="muted">${Store.state.budget.income.length} ${Store.state.budget.income.length > 1 ? trad('sources de revenus') : trad('source de revenus')}</span>
          <span class="flux-chev" aria-hidden="true">›</span>
        </button>
        <p class="empty" style="margin:12px 0 0">${trad('Le partage de ce revenu se dessinera dès que tes charges fixes seront connues.')}</p>
        ${invitePremierPas('depenses', { secondaire: true })}`;
        const sources = Store.state.budget.income.length;
        return `
        <button type="button" class="flux-total" data-action="toggle-revenus"
                title="${trad('Voir et modifier les sources de revenus')}${revenuEstime()
                  ? trad(' · une partie est déclarée en montant estimé') : ''}">
          <b>${revenuEstime() ? '≈ ' : ''}${fmtEUR0(f.income)}</b>
          <span class="muted">${sources} ${sources > 1 ? trad('sources de revenus') : trad('source de revenus')}${
            revenuEstime() ? trad(', en partie estimés') : ''}</span>
          <span class="flux-chev" aria-hidden="true">›</span>
        </button>
        <div class="hero-barre" role="img"
             aria-label="${trad('Partage')}${deuxPoints()} ${parts.map(([l, , , pct]) =>
               `${esc(l)} ${fmtPct(pct, 0)}`).join(', ')}">
          ${parts.map(([, , couleur, pct]) => `<i style="width:${Math.max(0, Math.min(100, pct)).toFixed(2)}%;
            background:${couleur}"></i>`).join('')}
        </div>
        <div class="flux-legende">
          ${parts.map(([label, val, couleur, pct, ouvrable, aideTexte]) => {
            const corps = `
              <span class="dot" style="background:${couleur}"></span>
              <span class="repart-nom">${esc(label)}${aideTexte ? aide(aideTexte) : ''}</span>
              <b>${fmtEUR0(val)}</b>
              <span class="repart-pct">${fmtPct(pct, 1)}</span>`;
            /* Deux lignes menent quelque part, et pas au meme endroit : les
               charges fixes ont leur propre carte dans l'onglet voisin, et
               l'objectif de depenses se regle dans la fenetre que le montant de
               la carte du mois ouvre aussi. Un seul champ, deux portes.

               `goto` vise `budget-cadre`, la route du sous-onglet : viser
               `budget` rendrait la page des depenses, ou l'ancre « charges »
               n'existe pas, et le clic ne ferait rien du tout.

               La troisieme ligne reste inerte a dessein : c'est un reste, il se
               deduit des deux autres et ne se saisit pas. */
            if (ouvrable === 'ancre') {
              return `<button type="button" class="repart-haut flux-lien"
                              data-action="goto" data-view="budget-cadre" data-anchor="charges"
                              title="${trad('Aller au détail des charges fixes')}">${corps}</button>`;
            }
            if (ouvrable === 'objectif') {
              return `<button type="button" class="repart-haut flux-lien"
                              data-action="regler-objectif-depenses"
                              title="${trad('Modifier l’objectif de dépenses')}">${corps}</button>`;
            }
            return `<div class="repart-haut">${corps}</div>`;
          }).join('')}
        </div>`;
      })()}
      </div>
    </div>
    <div class="duo-col">
    ${carteAccumulation()}

    ${carteInsights('budget', 'À retenir')}
    </div>
  </div>`}

  ${cadre ? '' : `
  ${aDesDepensesSaisies() ? `
  <div class="grid g-4 g-tuiles">
    ${tile(`${trad('Dépenses')} ${year}`, stats.total, null, 'var(--series-2)',
           `${stats.months} ${trad('mois · hors charges fixes')}`, 'depensesAnnee')}
    ${tile('Moyenne par mois', stats.average, null, 'var(--series-4)',
           `${trad('sur')} ${stats.moisRetenus} ${trad('mois clos, hors charges fixes')}`
             + (stats.moisEnCoursExclu ? ' ' + trad('et hors mois en cours') : ''),
           /* Sa fiche ventile la moyenne par categorie : elle n'a plus de
              question a laquelle repondre quand on a demande a ne plus les
              detailler. Sans apercu, `tile()` rend une tuile simple et non
              cliquable -- le chiffre reste, il est global, c'est sa
              DECOMPOSITION qui s'en va. Ouvrir la liste des mois a la place
              aurait double la fiche de la tuile voisine, qui la porte deja. */
           sansDistinction() ? null : 'depensesCategories')}
    <button type="button" class="tile tile-link" style="--tile-color:var(--good)"
            data-action="apercu" data-apercu="moisObjectif" data-arg="sous">
      <span class="t-label">${trad('Mois sous objectif')}</span>
      <span class="t-value">${stats.under}</span>
      <span class="t-meta">${trad('sur')} ${stats.moisRetenus} ${trad('mois clos')}</span>
      <span class="t-go">⋯</span>
    </button>
    <button type="button" class="tile tile-link" style="--tile-color:var(--critical)"
            data-action="apercu" data-apercu="moisObjectif" data-arg="sur">
      <span class="t-label">${trad('Mois dépassés')}</span>
      <span class="t-value">${stats.over}</span>
      <span class="t-meta">${stats.worst ? `${trad('pire :')} ${esc(stats.worst.label)} ${trad('à')} ${fmtEUR0(stats.worst.total)}` : ''}</span>
      <span class="t-go">⋯</span>
    </button>
  </div>

  <div class="card">
    <div class="card-head">
      <h2>${trad('Dépenses mensuelles')}</h2>
      <span class="hint">${trad('objectif')} ${fmtEUR0(b.monthlyTarget)}</span>
      ${yearControl('budget-year', years, year)}
    </div>
    <div class="chart" id="bChart"></div>
    <div class="goal-foot" style="margin-top:12px">
      <span>${trad('Moyenne')} ${esc(year)}
        <b>${fmtEUR0(stats.average)} ${trad('/ mois')}</b>${stats.moisEnCoursExclu
          ? `<span class="sub">${trad('sur')} ${stats.moisRetenus} ${trad('mois clos, le mois en cours est écarté')}</span>` : ''}</span>
      <span class="${classeDepassement(stats.average, f.target)}">${
        stats.average ? `${fmtSigned(stats.average - f.target)} ${trad('vs objectif')}` : ''}</span>
    </div>
    <p class="small muted" style="margin:12px 0 0">
      ${trad('Vert sous l’objectif, orange au-dessus, rouge à partir de')} ${fmtPct(SEUIL_DEPASSEMENT_GRAVE * 100, 0)} ${trad('de dépassement. Survole une barre pour la note du mois.')}
    </p>
    <details class="data-view">
      <summary>${trad('Voir les données')}</summary>
      <table>
        <thead><tr><th>${trad('Mois')}</th><th>${trad('Dépensé')}</th><th>${trad('vs objectif')}</th><th style="text-align:left">${trad('Note')}</th></tr></thead>
        <tbody>${expenseSeriesVisible(year).map(r => `<tr>
          <td class="name">${esc(r.label)}</td>
          <td>${r.total ? fmtEUR0(r.total) : ''}</td>
          <td class="${classeDepassement(r.total, f.target)}">${r.total ? fmtSigned(r.total - f.target) : ''}</td>
          <td style="text-align:left" class="muted small">${esc(r.note || '')}</td></tr>`).join('')}</tbody>
      </table>
    </details>
  </div>

  ${sansDistinction() ? '' : `
  <div class="card">
    <div class="card-head"><h2>${trad('Par catégorie')}</h2>
      <div class="row">
        <span class="hint">${fmtEUR0(stats.total)} ${trad('au total')}</span>
        ${yearControl('budget-year', years, year)}
      </div>
    </div>
    <div class="chart" id="bCats"></div>
    <details class="data-view">
      <summary>${trad('Voir les données')}</summary>
      <table>
        <thead><tr><th>${trad('Catégorie')}</th><th>${trad('Total')}</th>
          <th>${trad('/ mois')}</th><th>%</th></tr></thead>
        <tbody>${cats.map(c => `<tr>
          <td class="name">${esc(trad(c.label))}</td>
          <td>${fmtEUR0(c.value)}</td>
          <td>${fmtEUR0(c.average)}</td>
          <td class="muted">${fmtPct(c.pct, 1)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>${trad('Total')}</td><td>${fmtEUR0(stats.total)}</td>
          <td>${fmtEUR0(stats.average)}</td><td></td></tr></tfoot>
      </table>
    </details>
  </div>`}` : ''}

  ${!aDesDepensesSaisies() ? '' : `
  <div class="card" data-anchor="detail-mensuel">
    <div class="card-head">
      <h2>${trad('Détail mensuel')}</h2>
      ${yearControl('budget-year', years, year)}
    </div>
    <div class="row" style="margin:-4px 0 12px">
      <span class="hint">${lignesDepenses.length} ${lignesDepenses.length > 1 ? trad('mois affichés') : trad('mois affiché')}${
        sansDistinction() ? '' : ` · ${expenseCategories().length} ${trad('catégories')}`}</span>
      <span class="spacer"></span>
      ${sansDistinction()
        ? `<button class="btn sm ghost" data-action="reprendre-detail" type="button"
                   title="${esc(trad('Reprendre le détail remet toutes tes catégories dans la saisie, y compris celles que tu avais retirées à la main : l’application ne sait pas les distinguer. Tu peux en retirer à nouveau, ligne par ligne, sans rien perdre.'))}"
             >${trad('Remettre toutes les catégories')}</button>`
        : `<button class="btn sm ghost" data-action="sans-distinction" type="button"
                   title="${esc(trad('Pour qui ne veut pas ventiler ses dépenses : une seule catégorie reste proposée à la saisie du mois, les autres sont retirées. Rien n’est effacé, les mois déjà détaillés gardent leur découpage dans le tableau, les graphiques et les exports. Réversible, et Ctrl+Z annule.'))}"
             >${trad('Une seule case à remplir')}</button>`}
      ${sansDistinction() ? ''
        : `<button class="btn sm ghost" data-action="add-category"
             >${trad('+ Ajouter une catégorie')}</button>`}
      <button class="btn sm ghost" data-action="importer-tableau" data-cible="depenses"
              >${trad('Importer un fichier')}</button>
    </div>
    ${(() => {
      const att = depensesEnAttente();
      if (!att.missing) return '';
      const visible = year === 'all' || String(att.key).startsWith(year);
      return `<div class="note note-relance" style="margin-bottom:12px">⚠ <span>
        <b>${esc(att.label)} ${trad('n’est pas saisi.')}</b> ${trad('Le mois est clos : '
          + 'c’est le moment d’enregistrer ce qu’il a coûté.')}${visible
          ? ` ${trad('Sa ligne est signalée ci-dessous.')}`
          : ` ${trad('Change l’année pour {a} pour la voir.')
              .replace('{a}', esc(String(att.key).slice(0, 4)))}`}</span>
        ${sortiesRappel('depenses', att.label,
          `<button class="btn sm" data-action="saisir-mois-en-attente">${trad('Saisir')} ${esc(att.label)}</button>`)}
      </div>`;
    })()}
    <div class="liste-mobile">
      ${lignesDepenses.map(({ r, i }) => {
        const tot = expenseRowTotal(r);
        const diff = tot - f.target;
        const att = attendu.missing && r.month === attendu.key;
        return ligneListe({
          action: 'edit-expense-month', index: i,
          titre: fmtMonth(r.month),
          sous: r.note || '',
          marque: att ? `<span class="marque-attendu" title="${trad('Le mois que la relance attend')}">⚠</span>` : '',
          valeur: tot ? fmtEUR0(tot) : '',
          second: tot ? fmtSigned(diff) : '', classeSecond: classeDepassement(tot, f.target),
        });
      }).join('')}
    </div>
    <div class="table-wrap large-seulement">
      <table class="editable">
        <thead><tr>
          ${(() => {
            const th = (key, label, classe = '') => {
              const on = depSort && depSort.key === key;
              const sens = !on ? trad('décroissant') : depSort.dir === 'desc' ? trad('croissant') : trad('calendrier');
              return `<th class="sortable ${on ? depSort.dir : ''} ${classe}">`
                + `<button type="button" class="th-tri" data-action="sort-depenses" data-key="${esc(key)}"`
                + ` title="${trad('Trier par')} ${esc(trad(label))}, ${trad('ordre')} ${sens}">${esc(trad(label))}</button></th>`;
            };
            return th('mois', 'Mois', 'sticky-col') + th('total', 'Total') + `<th>${trad('vs obj.')}</th>`
              + (sansDistinction() ? ''
                 : expenseCategories().map(c => th(`cat:${c}`, c)).join(''));
          })()}
          <th class="prose">${trad('Note du mois')}</th><th></th>
        </tr></thead>
        <tbody>${(depSort ? (() => {
          /* On trie une copie de la vue indexee : `data-i` continue de viser
             la vraie ligne, exactement comme le tableau des positions. */
          const cle = depSort.key.startsWith('cat:')
            ? ({ r }) => num(r.v[depSort.key.slice(4)])
            : depSort.key === 'total' ? ({ r }) => expenseRowTotal(r)
            : ({ r }) => String(r.month);
          const dir = depSort.dir === 'asc' ? 1 : -1;
          return [...lignesDepenses].sort((a, b) => {
            const va = cle(a), vb = cle(b);
            return (typeof va === 'string' ? va.localeCompare(vb) : va - vb) * dir;
          });
        })() : lignesDepenses).map(({ r, i }) => {
          const tot = expenseRowTotal(r);
          const diff = tot - f.target;
          const estMoisCourant = r.month === currentMonthKey();
          const estAttendu = attendu.missing && r.month === attendu.key;
          const classes = [estMoisCourant ? 'mois-courant' : '', estAttendu ? 'mois-attendu' : '']
            .filter(Boolean).join(' ');
          return `<tr class="ligne-ouvre${classes ? ` ${classes}` : ''}"
              data-action="edit-expense-month" data-i="${i}"
              title="${trad('Saisir les dépenses de')} ${esc(fmtMonth(r.month))}"${
              estMoisCourant ? ' data-anchor="mois-courant"' : ''}${estAttendu ? ' data-anchor="mois-attendu"' : ''}>
            <td class="name sticky-col"><span class="mois-lien">${esc(fmtMonth(r.month))}</span>${
              estAttendu ? `<span class="marque-attendu" title="${
                trad('Le mois que la relance attend')}">⚠</span>` : ''}</td>
            <td><b>${tot ? fmtEUR0(tot) : ''}</b></td>
            <td class="${classeDepassement(tot, f.target)}">${tot ? fmtSigned(diff) : ''}</td>
            ${sansDistinction() ? '' : expenseCategories().map(c => `<td>${
                r.v[c] != null && r.v[c] !== '' ? fmtEUR0(r.v[c]) : ''}</td>`).join('')}
            <td class="name prose">${esc(r.note || '')}</td>
            <td><button class="btn icon" data-action="del-expense-month" data-i="${i}" title="${trad('Supprimer')}">✕</button></td>
          </tr>`;
        }).join('')}</tbody>
        <tfoot><tr>
          <td class="sticky-col">${trad('Total {a}').replace('{a}', esc(year))}</td>
          <td>${fmtEUR0(stats.total)}</td><td></td>
          ${sansDistinction() ? '' : expenseCategories().map(c => {
            const v = cats.find(x => x.label === c);
            return `<td>${v ? fmtEUR0(v.value) : ''}</td>`;
          }).join('')}
          <td colspan="2"></td>
        </tr></tfoot>
      </table>
    </div>

    ${sansDistinction() ? '' : `    <details class="data-view" style="margin-top:12px">
      <summary>${trad('Renommer, retirer ou supprimer une catégorie')}</summary>
      <table class="editable table-serree">
        <thead><tr><th>${trad('Catégorie')}</th><th>${trad('Total saisi')}</th><th></th></tr></thead>
        <tbody>${expenseCategories().map(c => {
          const total = expenseCategoryTotal(c);
          const retiree = categorieRetiree(c);
          return `<tr${retiree ? ' class="cat-retiree"' : ''}>
            <td class="name"><input value="${esc(c)}" data-action-change="rename-category"
                data-cat="${esc(c)}" title="${trad('Modifie le nom puis quitte le champ')}">
              ${retiree ? `<span class="tag">${trad('retirée')}</span>` : ''}</td>
            <td class="${total ? '' : 'muted'}">${total ? fmtEUR0(total) : ''}</td>
            <td class="cat-actions">
              <span class="large-seulement">
                <button class="btn icon" data-action="monter-category" data-cat="${esc(c)}"
                  title="${trad('Avancer cette colonne d’un cran')}">↑</button>
                <button class="btn icon" data-action="descendre-category" data-cat="${esc(c)}"
                  title="${trad('Reculer cette colonne d’un cran')}">↓</button>
              </span>
              <button class="btn sm ghost" data-action="${retiree ? 'reprendre' : 'retirer'}-category"
                data-cat="${esc(c)}"
                title="${trad(retiree ? 'La reproposer à la saisie du mois'
                                    : 'La sortir de la saisie du mois, sans toucher aux montants passés')}"
                >${trad(retiree ? 'Reprendre' : 'Retirer')}</button>
              <button class="btn icon" data-action="del-category" data-cat="${esc(c)}"
                title="${trad('Supprimer cette colonne et tous ses montants')}">✕</button>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table>
      <p class="hint" style="margin-top:8px">
        <b>${trad('Retirer')}</b> ${trad("garde l'historique,")} <b>${trad('Supprimer')}</b> ${trad("l'efface.")}${aide(trad("Renommer déplace les montants déjà saisis. Retirer sort la catégorie de la saisie du mois sans toucher aux montants passés : c’est le geste pour un poste dans lequel tu ne dépenses plus. Supprimer retire la colonne et tout ce qu’elle contient. Ctrl+Z annule dans les deux cas."))}
      </p>
    </details>`}
  </div>`}`}

  ${!cadre ? '' : `
  <div class="card">
    <div class="card-head"><h2>${trad('Ce qui sort chaque mois')}</h2>
      ${(() => {
        const n = b.fixedCharges.filter(c => chargeMensuelle(c) > 0).length;
        return n ? `<span class="hint">${n} ${n > 1 ? trad('postes') : trad('poste')}</span>` : '';
      })()}</div>
    ${(() => {
      /* CE QUI EST DEBITE, comme `f.fixed` juste au-dessus : les deux viennent de
         la meme convention, sinon les pourcentages de cette carte ne feraient
         plus cent. */
      const postes = b.fixedCharges
        .map(c => ({ nom: c.label || 'Sans nom', v: chargeMensuelle(c) }))
        .filter(x => x.v > 0)
        .sort((a, x) => x.v - a.v);
      /* Le texte vit dans `PREMIERS_PAS` : c'est le meme que celui de l'invite,
         et l'ecrire ici en plus les aurait laisses diverger. Le repli sert au cas
         ou des charges existent mais toutes a zero — le pas est franchi, il n'y a
         pourtant rien a montrer. */
      if (!postes.length) return invitePremierPas('depenses')
        || `<p class="empty" style="margin:0">${trad('Aucune charge fixe déclarée.')}</p>`;
      return `
      <div class="charges-tete">
        <div class="ct-chiffre">
          <b>${fmtEUR(f.fixed)}</b>
          <span class="muted">${trad('par mois,')}${f.fixedPct == null ? '' : ` ${fmtPct(f.fixedPct, 1)} ${trad('de tes revenus')}`}</span>
        </div>
        <div class="ct-cote">
          <div class="ct-petit">
            <span class="muted">${trad('Sur douze mois')}${aide(trad("Le même total, vu à l’année. Un abonnement de 30 {dev} par mois coûte 360 {dev} par an : c’est à cette échelle qu’on décide de le garder ou non."))}</span>
            <b>${fmtEUR0(f.fixed * 12)}</b>
          </div>
        </div>
      </div>
      <button type="button" class="flow-lien" style="margin-top:12px"
              data-action="apercu" data-apercu="chargesFixes"
              title="${trad('Voir les')} ${postes.length} ${trad('postes avec leur part')}">
        <p class="small muted" style="margin:0">${trad('Voir la part de chaque poste ›')}</p>
      </button>`;
    })()}
  </div>

  <div class="grid">
    <div class="card" data-anchor="charges">
      <div class="card-head">
        <div class="tete-titre">
          <h2>${trad('Charges fixes')}</h2>
          ${!b.fixedCharges.length ? '' : `<span class="hint">${fmtEUR(f.fixed)} ${trad('/ mois')}${f.fixedPct == null ? '' : ` · ${fmtPct(f.fixedPct, 1)} ${trad('des revenus')}`}</span>`}
        </div>
        <button class="btn sm ghost" data-action="add-charge">${trad('+ Ligne')}</button>
      </div>
      ${(() => {
        if (!b.fixedCharges.length) return `
      <p class="empty" style="margin:0">${trad('Tes loyers, assurances et abonnements '
        + 'viendront ici, chacun avec sa cadence.')}</p>`;
        const brut = b.fixedCharges.reduce((s, c) => s + chargeMensuelle(c), 0);
        return `
      <div class="liste-mobile" id="chargesListe">
        ${chargesOrdonnees().map(({ c, i }) => `${ligneListe({
          action: 'edit-charge', index: i,
          titre: c.label || 'Sans nom',
          sous: [c.provider || '', chargePeriode(c) === 'mois' ? ''
            : trad(CHARGE_PERIODE_LABEL[chargePeriode(c)]),
            prochaineEcheance(c)
              ? `${trad('prochaine le')} ${fmtJourMois(prochaineEcheance(c))}` : '',
            (() => {
              if (!c.creditId) return '';
              const cr = creditsEnCours().lignes.find(x => x.id === c.creditId);
              if (!cr) return '';
              return cr.capital != null
                ? `${trad('rembourse')} ${guill(cr.libelle)}, ${trad('dont')} ${fmtEUR0(cr.capital)} ${trad('de capital')}`
                : `${trad('rembourse')} ${guill(cr.libelle)}`;
            })()].filter(Boolean).join(' · '),
          valeur: `${fmtEUR(chargeMensuelle(c))} ${trad('/ mois')}`,
          /* L'equivalent annuel, sous le mensuel et plus discret : c'est a cette
             echelle qu'on decide de garder un abonnement, et le calculer de tete
             sur treize lignes n'arrive jamais. Douze fois le mensuel, et non une
             seconde regle de conversion : `chargeMensuelle` a deja ramene la
             periodicite au mois, quelle qu'elle soit. */
          second: `${fmtEUR0(chargeMensuelle(c) * 12)} ${trad('/ an')}`,
        })}`).join('')}
        <dl class="kv repart-pied">
          <dt>${trad('Total / mois')}</dt><dd>${fmtEUR(brut)}</dd>
        </dl>
      </div>
      <div class="table-wrap large-seulement">
        <table class="editable">
          <thead><tr>
            <th class="sticky-col">${trad('Poste')}</th><th>${trad('Montant')}</th><th>${trad('Facturé')}</th>
            <th title="${trad('Ce que la ligne pèse chaque mois, quelle que soit sa périodicité')}">${trad('{dev} / mois')}</th>
            <th>${trad('% charges')}</th>
            <th>${trad('Organisme')}</th><th></th>
          </tr></thead>
          <tbody id="chargesTable">${chargesOrdonnees().map(({ c, i }) => `<tr class="ligne-ouvre"
              data-action="edit-charge" data-i="${i}"
              title="Modifier ${guill(esc(c.label || 'Sans nom'))}">
            <td class="name sticky-col"><span class="mois-lien">${esc(c.label || 'Sans nom')}</span></td>
            <td>${fmtEUR(num(c.amount))}</td>
            <td>${esc(trad(CHARGE_PERIODE_LABEL[chargePeriode(c)]))}${prochaineEcheance(c)
              ? `<span class="sub">${trad('prochaine le')} ${fmtJourMois(prochaineEcheance(c))}</span>` : ''}</td>
            <td class="${chargePeriode(c) === 'mois' ? 'muted' : ''}">${fmtEUR(chargeMensuelle(c))}</td>
            <td class="muted">${fmtPct(brut ? chargeMensuelle(c) / brut * 100 : 0, 1)}</td>
            <td class="name">${esc(c.provider || '')}</td>
            <td><button class="btn icon" data-action="del-charge" data-i="${i}" title="${trad('Supprimer')}">✕</button></td>
          </tr>`).join('')}</tbody>
          <tfoot><tr>
            <td class="sticky-col">${trad('Total / mois')}</td><td colspan="2"></td>
            <td><b>${fmtEUR(brut)}</b></td><td>${fmtPct(100)}</td>
            <td colspan="2"></td>
          </tr></tfoot>
        </table>
      </div>
      ${sharedTotals().parPersonne.length ? `
      <dl class="kv repart-pied">${sharedTotals().parPersonne.map(x => `
        <dt class="muted"><button type="button" class="mois-lien"
            data-action="editer-personne" data-id="${esc(x.id)}">${
          esc(trad('Part théorique de {n}').replace('{n}', x.nom))}</button></dt>
        <dd class="muted">${fmtEUR(x.total)}</dd>`).join('')}
      </dl>` : ''}
      <p class="hint" style="margin:8px 0 0">
        <button type="button" class="mois-lien"
                data-action="ajouter-personne">${trad('+ Personne')}</button>
      </p>
`;
      })()}
    </div>

  </div>`}`;
}

partieChargee('assets/app-06-fiche-compte-page.js');
