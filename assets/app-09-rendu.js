/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */
const MOUNTS = {
  overview: () => sousOngletActif.overview === 'projection' ? mountObjective()
    : sousOngletActif.overview === 'historique' ? mountHistory() : mountOverview(),
  positions: () => sousOngletActif.positions === 'cible' ? mountRebalance() : mountPositions(),
  allocation: mountAllocation,
  /* Les préférences n'ont rien à monter : leurs réglages passent tous par
     `data-path` et `data-action`, câblés une fois pour toute l'application. */
  data: () => { if (sousOngletActif.data !== 'preferences') mountData(); },
  budget: () => {
    if (sousOngletActif.budget === 'releves') mountHistory();
    else if (sousOngletActif.budget === 'depenses') mountBudget();
  },
  /* `objective` n'est plus une vue mais un onglet de `overview`, dont le montage
     ci-dessus appelle `mountObjective()`. L'entree reste : `#/objective` est
     redirigee, jamais rendue directement, mais une entree qui coute une ligne
     protege contre un appel oublie. */
  objective: mountObjective,
  /* `accounts` manquait : le champ de recherche et le glissement lateral des
     lignes sont branches dans mountAccounts(), qui n'etait donc jamais
     appele. La recherche laissait passer tout le monde — « zzz » affichait
     les six etablissements — et les actions revelees au glissement etaient
     inaccessibles. Le filtrage lui-meme etait juste : seul le cablage
     manquait. */
  accounts: mountAccounts,
};

/* Les fiches sont des pages, pas des fenêtres : `#/compte/<id>` et
   `#/etab/<id>` sont des routes à part entière — le bouton retour du
   navigateur fonctionne, et un lien vers une fiche se partage. */
function routeParam() {
  const m = location.hash.match(/^#\/(compte|etab)\/(.+)$/);
  return m ? { genre: m[1], id: decodeURIComponent(m[2]) } : null;
}

function ficheUnique(id) {
  const e = ETABS().find(x => x.id === id);
  if (!e || contenantDeLEtab(e.id).titre !== CONTENANTS.bien.titre) return null;
  const siens = COMPTES().filter(c => c.etabId === e.id && c.statut !== 'archive');
  return siens.length === 1 ? siens[0].id : null;
}

function currentView() {
  const r = routeParam();
  if (r && r.genre === 'etab') {
    const seul = ficheUnique(r.id);
    if (seul) { location.replace('#/compte/' + encodeURIComponent(seul)); return 'ficheCompte'; }
  }
  if (r) return r.genre === 'compte' ? 'ficheCompte' : 'ficheEtab';
  const v = (location.hash.replace('#/', '') || 'overview');
  const red = REDIRECTIONS[v];
  if (red) { sousOngletActif[red[1]] = red[2]; return red[0]; }
  if (SOUS_ONGLETS[v]) sousOngletActif[v] = SOUS_ONGLETS[v][0][0];
  return VIEWS[v] ? v : 'overview';
}

/* Les sources de revenu, dans une fenêtre. Elles vivaient au bas de la carte
   « Où va ce que tu gagnes », dans un dépliant qui redisait le montant déjà porté
   par la barre du haut et terminait la carte par un tableau. C'est la barre
   « Revenus » qui les ouvre maintenant, là où le regard se pose.

   Le balisage est celui d'avant, à l'identique : les champs portent leur
   `data-path`, la suppression et l'ajout leurs actions, et les écouteurs qui
   les servent sont posés sur le document. Rien à recâbler, et la saisie
   s'enregistre au fil de la frappe comme partout ailleurs. D'où l'absence de
   bouton « Valider » : il n'y a rien à valider. */
function fenetreRevenus() {
  const m = $('#modal');
  const b = Store.state.budget;
  const total = b.income.reduce((s, r) => s + revenuMensuel(r), 0);
  apercuOuvert = null;

  $('#modalTitle').textContent = trad('Revenus');
  $('#modalSub').innerHTML = escMontant(
    `${revenuEstime() ? '≈ ' : ''}${fmtEUR0(total)} ${trad('par mois sur')} ${b.income.length} ${b.income.length > 1 ? trad('sources') : trad('source')}`
    + (revenuEstime() ? trad(', dont des montants estimés') : ''));
  const biens = comptesBiens();
  $('#modalBody').innerHTML = `
    <div class="rev-liste">${b.income.map((r, i) => `
      <div class="rev-source">
        <div class="rev-tete">
          <div class="field rev-nom">
            <label>${trad('Source')}</label>
            <input data-path="budget.income.${i}.label" value="${esc(r.label)}"
                   placeholder="${trad('ex. Salaire net, loyer perçu')}">
          </div>
          <button class="btn icon rev-suppr" data-action="del-income" data-i="${i}"
                  title="${trad('Supprimer cette source')}">✕</button>
        </div>
        <div class="rev-champs">
          <div class="field">
            <label>${trad('Montant')}</label>
            <input type="number" step="any" data-path="budget.income.${i}.amount" value="${r.amount}">
          </div>
          <div class="field">
            <label>${trad('Période')}</label>
            <select data-path="budget.income.${i}.period" class="annee">
              ${CHARGE_PERIODES.map(([cle, label]) => `<option value="${cle}"
                ${chargePeriode(r) === cle ? 'selected' : ''}>${trad(label)}</option>`).join('')}
            </select>
          </div>
          ${biens.length ? `<div class="field">
            <label>${trad('Bien rattaché')}</label>
            <select data-path="budget.income.${i}.bienId" class="annee">
              <option value="">${trad('aucun')}</option>
              ${biens.map(c => `<option value="${esc(c.id)}" ${c.id === r.bienId ? 'selected' : ''}
                >${esc(nomCompteV2(c))}</option>`).join('')}
            </select>
          </div>` : ''}
        </div>
        <div class="rev-pied">
          <label class="rev-estime" title="${trad('Un revenu variable déclaré en moyenne : les écrans qui s’en servent le diront')}">
            <input type="checkbox" data-action-change="revenu-estime" data-i="${i}"
                   ${r.estime ? 'checked' : ''}>${trad(' montant estimé')}</label>
          <span class="spacer"></span>
          <span class="muted">${chargePeriode(r) !== 'mois'
            ? `${trad('soit')} ${fmtEUR0(revenuMensuel(r))} ${trad('/ mois')} · ` : ''}${
            fmtPct(total ? revenuMensuel(r) / total * 100 : 0, 1)} ${trad('du total')}</span>
        </div>
      </div>`).join('')}</div>
    <div class="rev-total">
      <span>${trad('Total')}</span><b>${fmtEUR(total)} ${trad('/ mois')}</b>
    </div>
    <div class="row" style="margin-top:12px">
      <button class="btn sm ghost" data-action="add-income">${trad('+ Ajouter une source de revenu')}</button>
    </div>`;
  $('#modalFoot').innerHTML =
    `<button class="btn" id="revOk" type="button">${trad('Enregistrer')}</button>
     <button class="btn ghost" id="revClose" type="button">${trad('Fermer')}</button>`;
  montrerModal(m);

  const fermer = () => {
    masquerModal(m);    $('#modalClose').onclick = null;
    revenusOuvert = false;
    render();
  };
  revenusOuvert = true;
  $('#revOk').onclick = () => {
    /* Le blur d'abord, comme ailleurs : sur iOS un champ encore actif peut
       n'avoir pas emis son dernier `input`. */
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    Store.save();
    toast(`${trad('Enregistré ✓')} · ${fmtEUR(incomeTotal())} ${trad('/ mois')}`);
  };
  $('#revClose').onclick = fermer;
  $('#modalClose').onclick = fermer;
}

function askText(titre, message, exemple = '', valeur = '', max = NOM_LIGNE_MAX) {
  return new Promise(resolve => {
    const m = $('#modal');
    apercuOuvert = null;
    /* Les trois textes se traduisent ici, pas chez l'appelant : c'est le meme
       regime que les descripteurs d'`askForm`, et le français passe pour la
       clef. Sans cela, chaque appel devait y penser, et sept sur dix l'oubliaient. */
    $('#modalTitle').textContent = trad(titre);
    $('#modalSub').textContent = message ? trad(message) : '';
    $('#modalBody').innerHTML = `
      <div class="modal-champs">
        <div class="field">
          <input id="txtValeur" value="${esc(valeur)}" placeholder="${esc(trad(exemple))}"
                 maxlength="${max}" autocomplete="off" spellcheck="false">
        </div>
      </div>`;
    $('#modalFoot').innerHTML =
      `<button class="btn ghost" id="txtCancel" type="button">${trad('Annuler')}</button>
       <button class="btn" id="txtOk" type="button">${trad('Valider')}</button>`;
    montrerModal(m);
    const champ = $('#txtValeur');
    focusChamp(champ);

    const fermer = v => {
      masquerModal(m);      $('#modalClose').onclick = null;
      champ.onkeydown = null;
      resolve(v);
    };
    /* Valider a vide ne ferme pas : cette fenetre ne demande qu'une chose, et
       repartir sans elle n'a jamais de sens. Elle le dit et garde la main, comme
       un champ `requis` d'`askForm` — c'est « Annuler » qui sert a renoncer. */
    const valider = () => {
      const v = champ.value.trim();
      if (!v) { champ.focus(); toast(`${titre}${deuxPoints()} ${trad('à remplir')}`); return; }
      fermer(v);
    };
    champ.onkeydown = e => {
      if (e.key === 'Enter') { e.preventDefault(); valider(); }
      if (e.key === 'Escape') { e.stopPropagation(); fermer(null); }
    };
    $('#txtCancel').onclick = () => fermer(null);
    $('#modalClose').onclick = () => fermer(null);
    $('#txtOk').onclick = valider;
  });
}

/* ------------------------------------------------------------
   Formulaire generique

   Ajouter une ligne creait jusqu'ici une rangee vide « Nouvelle charge » a
   remplir dans le tableau, case par case, en devinant ce qu'attendait
   chaque colonne. Une fenetre nomme les champs, propose des listes la ou
   les valeurs sont contraintes, et ne cree la ligne qu'une fois remplie —
   donc pas de rangee fantome si l'on renonce.

   Un champ : { cle, label, type, valeur, options, aide, exemple, requis }
   type : 'texte' | 'nombre' | 'liste' | 'case'. Renvoie un objet, ou null.

   `encore` : le libelle d'un troisieme bouton, qui enregistre et rouvre la
   fenetre vide. Il ne s'affiche que si l'appelant le demande — une fenetre de
   modification n'a rien a enchainer, on ne modifie pas deux fois la meme ligne.
   La reponse porte alors `__encore`, et c'est l'appelant qui boucle : lui seul
   sait ce qu'il faut recalculer entre deux saisies. Le double blanc au nom du
   drapeau evite la collision avec un champ, dont les cles remplissent le meme
   objet.
   ------------------------------------------------------------ */
async function demanderTypePerso() {
  const r = await askForm({
    titre: trad('Nouveau type de compte'),
    sous: trad('Il rejoint la liste, pour ce compte et les suivants'),
    ok: 'Créer',
    champs: [
      /* `requis` : sans lui, valider a vide fermait la fenetre sans un mot. Le
         type ne se creait pas — `creerTypePerso` refuse un nom vide — mais rien
         ne le disait, et le geste ressemblait a une reussite. Un champ dont
         l'absence annule tout doit le dire avant de fermer. */
      { cle: 'nom', label: trad('Nom du nouveau type'), type: 'texte', requis: true,
        exemple: trad('ex. Plan d’épargne logement') },
      { cle: 'poche', label: trad('Il se comporte comme'), type: 'liste', valeur: 'cash',
        options: [['cash', trad('De l’argent disponible (livret, compte courant)')],
                  ['bourse', trad('Un compte de titres (PEA, CTO)')],
                  ['pe', trad('Une part ou un placement non coté')]],
        aide: trad('ce choix commande les regroupements d’écran et la disponibilité') },
    ],
  });
  if (!r || !String(r.nom || '').trim()) return null;
  const id = creerTypePerso(r.nom, r.poche);
  Store.save();
  return id;
}

function askForm({ titre, sous = '', champs, ok = 'Ajouter', lie = null, encore = '',
                   valide = null }) {
  return new Promise(resolve => {
    const m = $('#modal');
    apercuOuvert = null;
    $('#modalTitle').textContent = trad(titre);
    $('#modalSub').innerHTML = escMontant(sous);

    const rendu = c => {
      /* Une SECTION : un intitule, aucun champ.

         Un formulaire de seize champs se lit comme une liste sans fin sur un
         telephone. Nomme par etapes — le bien, son acquisition, son
         financement — il se parcourt : on sait ou l'on est, et ce qui reste.

         Elle ne porte aucune valeur, et les deux lectures l'ignorent d'elles-
         memes : `valeurs()` cherche `#f_<cle>` et passe son chemin quand il
         n'existe pas, la garde des champs requis ne regarde que ce que
         `valeurs()` a rendu. */
      if (c.type === 'section')
        return `<p class="sous-titre-carte" id="s_${c.cle}">${esc(trad(c.label))}</p>`;
      const id = `f_${c.cle}`;
      /* Un fait qui se deduit s'affiche, il ne s'edite pas.
         Le type d'un etablissement en est un : il vient des comptes rattaches.
         Son absence de cette fenetre se lirait comme un oubli plutot que comme
         une consequence, et on chercherait a le changer. Le montrer en lecture
         repond a la question sur place.
         Pas d'`<input disabled>` : un champ grise invite quand meme au clic, et
         il faudrait ensuite l'ecarter du depouillement. Du texte est du texte. */
      if (c.lecture) return `<div class="field">
        <label>${esc(trad(c.label))}${c.aide ? `<span class="sub">${esc(trad(c.aide))}</span>` : ''}</label>
        <p class="champ-lecture">${esc(String(c.valeur ?? ''))}</p>
      </div>`;
      /* UN RESULTAT SE LIT, IL NE SE SAISIT PAS. Un champ `calcul` derive des
         autres et se rafraichit a la frappe : il n'a donc pas d'identifiant en
         `f_`, et `valeurs()` ne le voit pas. C'est voulu et c'est la regle de la
         maison — deux surfaces d'edition pour une meme valeur, et personne ne
         peut prouver qu'elles s'accordent. Ici le total est le produit de deux
         champs qui sont juste au-dessus : il les redit, il ne s'ajoute pas a
         eux. */
      if (typeof c.calcul === 'function') return `<div class="field">
        <label>${esc(trad(c.label))}${c.aide ? `<span class="sub">${esc(trad(c.aide))}</span>` : ''}</label>
        <p class="champ-lecture" id="c_${c.cle}"></p>
      </div>`;
      if (c.type === 'case') return `
        <label class="field-case">
          <input type="checkbox" id="${id}" ${c.valeur ? 'checked' : ''}>
          <span>${esc(trad(c.label))}${c.aide ? `<span class="sub">${esc(trad(c.aide))}</span>` : ''}</span>
        </label>`;
      /* `suggestions` : ce qui a deja ete tape dans ce champ, propose sans etre
         impose. Un `datalist` et non une liste deroulante — le choix ferme
         conviendrait a un type de compte, pas a un organisme : il y en a une
         infinite, et le jour ou l'on change d'assureur il faut pouvoir taper le
         nouveau nom sans passer par « Autre… ».
         Le `<datalist>` ne s'affiche pas, il n'ajoute donc rien a la mise en
         page ; `autocomplete="off"` le laisse fonctionner, il ne parle qu'aux
         suggestions du navigateur. */
      /* `max` : la longueur maximale d'un champ de texte. Le navigateur refuse
         alors la frappe au-dela, ce qui vaut mieux qu'un message apres coup —
         on n'ecrit pas trente-cinq caracteres pour se les voir refuser. */
      const dl = (c.suggestions || []).length ? `dl_${c.cle}` : '';
      /* Une option est `[valeur, libelle]` ; un groupe est `[titre, options]`,
         et se rend en optgroup. La liste des types de compte s'en sert : dix-sept
         entrees a plat ne se lisaient plus. */
      const option = ([v, l]) =>
        `<option value="${esc(String(v))}" ${String(v) === String(c.valeur ?? '') ? 'selected' : ''}>${esc(trad(l))}</option>`;
      const saisie = c.type === 'liste'
        ? `<select id="${id}">${(c.options || []).map(([v, l]) => Array.isArray(l)
            ? `<optgroup label="${esc(trad(v))}">${l.map(option).join('')}</optgroup>`
            : option([v, l])).join('')}</select>`
        : `<input id="${id}" type="${c.type === 'nombre' ? 'number' : c.type === 'date' ? 'date' : 'text'}"
              ${c.type === 'nombre' ? (b => `step="any" inputmode="decimal" min="${b.min}" max="${b.max}"`)(
                BORNES_NOMBRE[c.genre || genreDeCle(c.cle)] || BORNES_NOMBRE.montant) : 'autocomplete="off"'}
              ${dl ? `list="${dl}"` : ''}
              ${c.max ? `maxlength="${+c.max}"` : ''}
              value="${esc(String(c.valeur ?? ''))}" placeholder="${esc(trad(c.exemple || ''))}">
           ${dl ? `<datalist id="${dl}">${c.suggestions.map(s =>
              `<option value="${esc(s)}"></option>`).join('')}</datalist>` : ''}`;
      /* `mois` : sous un champ de date, le mois ecrit en lettres, tenu a jour.
         Une date au format du navigateur ne dit pas a quel mois elle appartient
         sans un calcul de tete, et c'est pourtant la question qu'on se pose en
         datant un mouvement : « ça compte dans quel mois ». Le drapeau est
         explicite, champ par champ : toutes les dates de l'application n'ont
         pas cette question. */
      /* `parPart` : sous un montant total, LA FORMULE qui le lie au nombre de
         parts, et le prix par part en est un terme.

         Il etait un second champ sous un second libelle, avec « l'un remplit
         l'autre » en sous-titre : quatre champs nombre qui se ressemblaient, et
         la relation entre eux decrite en abstrait. On se demandait lequel
         remplir, lequel etait calcule, lequel faisait foi. La formule montre le
         calcul reel, avec les valeurs formatees comme partout ailleurs :
         « 2 750 parts × [3] € / part = 8 250 € », et pour l'investissement
         « 5 000 € ÷ 2 750 parts = [1,8182] € / part » — le sens de lecture suit
         le geste : un prix du jour revalorise le total, un montant investi se
         ramene a un prix d'achat (et ce prix, tape, redonne le nombre de parts :
         c'est ce que dit le sous-titre qui reste).

         Le champ n'a pas de `cle` et n'entre pas dans `champs` : `valeurs()`
         parcourt les champs declares, donc il ne se lit ni ne se stocke, tout
         comme le miroir du mois juste au-dessus. Les termes ecrits en texte sont
         tenus a jour par le cablage d'`askForm`, qui seul connait les valeurs.
         Un terme absent s'ecrit « — », et le resultat d'un produit dont le total
         n'est pas encore ecrit ne s'affiche pas : c'est lui que la frappe du
         prix va remplir. */
      return `<div class="field">
        <label for="${id}">${esc(trad(c.label))}${c.aide ? `<span class="sub">${esc(trad(c.aide))}</span>` : ''}</label>
        ${saisie}
        ${c.mois ? `<span class="hint" id="${id}_mois"></span>` : ''}
        ${!c.parPart ? '' : `<div class="champ-par-part" id="${id}_formule">${c.parPartDeduitParts ? `
          <span class="formule-val" data-role="total">…</span><span class="formule-op">÷</span>
          <span class="formule-val" data-role="parts">…</span><span class="formule-op">=</span>
          <input id="${id}_part" type="number" step="any" inputmode="decimal" placeholder="0"
                 aria-label="${esc(trad(c.parPartLabel))}"><span class="formule-unite">${esc(trad('{dev} / part'))}</span>` : `
          <span class="formule-val" data-role="parts">…</span><span class="formule-op">×</span>
          <input id="${id}_part" type="number" step="any" inputmode="decimal" placeholder="0"
                 aria-label="${esc(trad(c.parPartLabel))}"><span class="formule-unite">${esc(trad('{dev} / part'))}</span>
          <span class="formule-op" data-role="egal">=</span><span class="formule-val" data-role="total">…</span>`}
          ${c.parPartSous ? `<span class="sub formule-sous">${esc(trad(c.parPartSous))}</span>` : ''}
        </div>`}
      </div>`;
    };

    $('#modalBody').innerHTML = `<div class="modal-champs">${champs.map(rendu).join('')}</div>`;
    /* Un champ qui ne s'applique pas DISPARAIT, il ne se grise pas.

       « As-tu encore un credit sur ce bien ? » ne sert a rien si les six champs
       du pret restent la dessous : la question se pose, la reponse ne change
       rien a ce qu'il y a a lire. `montreSi` lit les valeurs courantes et se
       rejoue a chaque frappe.

       Une section se masque comme un champ : son intitule n'a pas de raison de
       rester quand la matiere qu'il annonce est partie. */
    const conditionnels = champs.filter(c => typeof c.montreSi === 'function');
    const majVisibles = () => {
      if (!conditionnels.length) return;
      const out = valeurs();
      for (const c of conditionnels) {
        /* `c_` : un champ calcule se masque comme les autres. */
        const el = $(`#f_${c.cle}`) || $(`#s_${c.cle}`) || $(`#c_${c.cle}`);
        const hote = el && (el.closest('.field') || el);
        if (hote) hote.hidden = !c.montreSi(out);
      }
    };
    /* Le bouton d'enchainement prend sa propre ligne, en pied. Trois boutons
       cote a cote, dont un qui porte six mots, ne tiennent pas dans 375 px :
       `.modal-foot` les fait deja se replier, mais le repli tombait ou il
       tombait. Une ligne declaree vaut mieux qu'un repli subi. */
    $('#modalFoot').innerHTML =
      `<button class="btn ghost" id="frmCancel" type="button">${trad('Annuler')}</button>
       <button class="btn" id="frmOk" type="button">${esc(trad(ok))}</button>
       ${encore ? `<button class="btn ghost btn-encore" id="frmEncore" type="button">${esc(trad(encore))}</button>` : ''}`;
    montrerModal(m);

    const liens = !lie ? [] : Array.isArray(lie) ? lie : [lie];
    const majs = liens.map(l => {
      const source = $(`#f_${l.de}`), cible = $(`#f_${l.vers}`);
      if (!source || !cible) return null;
      const majCible = () => {
        const opts = l.options(source.value);
        const garde = cible.value;
        cible.innerHTML = opts.length
          ? opts.map(([v, lib]) => `<option value="${esc(String(v))}">${esc(lib)}</option>`).join('')
          : `<option value="">${esc(l.vide || 'aucun choix possible')}</option>`;
        if (opts.some(([v]) => String(v) === garde)) cible.value = garde;
        cible.disabled = !opts.length;
        if (cible.value !== garde) cible.dispatchEvent(new Event('change', { bubbles: true }));
      };
      source.addEventListener('change', majCible);
      return majCible;
    });
    for (const maj of majs) if (maj) maj();

    for (const c of champs.filter(x => x.mois && x.type === 'date')) {
      const champ = $(`#f_${c.cle}`), miroir = $(`#f_${c.cle}_mois`);
      if (!champ || !miroir) continue;
      const maj = () => {
        miroir.textContent = champ.value
          ? `${trad('Compté dans')} ${fmtMoisAn(champ.value)}`
          : trad('Sans date, ce mouvement ne compte dans aucun mois.');
      };
      champ.addEventListener('input', maj);
      champ.addEventListener('change', maj);
      maj();
    }

    /* LE PRIX D'UNE PART SE SAISIT, DANS LES DEUX SENS.

       Une societe qui leve annonce un prix par part, pas la valeur d'un bloc.
       Saisir le total obligeait a multiplier de tete, et une multiplication de
       tete est une erreur qui entre dans le patrimoine sans prevenir.

       LE TOTAL RESTE LA VERITE, et ce n'est pas un detail de cablage. Le
       patrimoine additionne `valeur` ; treize ecrans lisent ce montant. Deux
       champs pour une meme valeur finissent toujours par diverger, et un prix
       par part arrondi au centime rendrait un total faux — 7 529 fois 1,33 fait
       10 013 et non les 10 000 saisis.

       QUATRE REGLES, et la quatrieme a manque. Taper le prix par part ECRIT le
       total ; taper le total recalcule le prix par part ; changer le nombre de
       parts recalcule le prix par part, JAMAIS le total — celle-la compte, un
       recalcul du total ferait bouger un montant qu'on n'a pas touche au moment
       ou l'on corrige une quantite.

       La quatrieme : quand le nombre de parts MANQUE et qu'un total et son prix
       par part sont tous deux ecrits, c'est le nombre qui se deduit. Sans elle,
       quelqu'un qui remplit d'abord les prix par part tapait dans le vide : la
       multiplication n'avait pas de multiplicateur, et rien ne le disait. Le
       champ promet « l'un remplit l'autre » et ne remplissait rien.

       Une deduction en entraine une autre : le nombre trouve sur une ligne sert
       aussitot a l'autre, dont le total attendait ce meme multiplicateur. D'ou
       les paires assemblees AVANT d'etre cablees — chacune doit pouvoir
       reveiller ses voisines.

       Quatre decimales au prix par part comme au nombre deduit : une part vaut
       souvent quelques euros, et une division tombe rarement rond. Le chiffre
       obtenu se corrige a la main, il ne se donne pas pour exact. */
    const fmtPartsFormule = v => `${moinsTypographique(num(v).toLocaleString(locale(),
      { maximumFractionDigits: 4 }))} ${trad('parts')}`;
    const fmtMontantFormule = v => moinsTypographique(new Intl.NumberFormat(locale(), {
      style: 'currency', currency: deviseBase(), currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0, maximumFractionDigits: 2,
    }).format(num(v)));
    const paires = [];
    for (const c of champs.filter(x => x.parPart)) {
      const total = $(`#f_${c.cle}`);
      const unite = $(`#f_${c.cle}_part`);
      const combien = $(`#f_${c.parPart}`);
      if (!total || !unite || !combien) continue;
      const n = () => num(combien.value);
      /* La formule redit les champs, elle ne calcule rien : ce sont `versUnite`
         et `versTotal` qui ecrivent, et elle se rafraichit a leur suite. Un
         terme vide s'ecrit « — » ; le resultat du produit attend son total. */
      const formule = $(`#f_${c.cle}_formule`);
      const majFormule = () => {
        if (!formule) return;
        const terme = role => formule.querySelector(`[data-role="${role}"]`);
        terme('parts').textContent = n() > 0 ? fmtPartsFormule(n()) : `… ${trad('parts')}`;
        const aTotal = total.value !== '';
        terme('total').textContent = aTotal ? fmtMontantFormule(total.value) : `… ${signeDeviseBase()}`;
        const egal = terme('egal');
        if (egal) { egal.hidden = !aTotal; terme('total').hidden = !aTotal; }
      };
      const versUnite = () => {
        unite.value = n() > 0 && total.value !== ''
          ? String(Math.round((num(total.value) / n()) * 10000) / 10000) : '';
        majFormule();
      };
      const versTotal = () => {
        if (n() > 0 && unite.value !== '')
          total.value = String(round2(num(unite.value) * n()));
        majFormule();
      };
      paires.push({ total, unite, combien, n, versUnite, versTotal, majFormule,
                    deduitParts: !!c.parPartDeduitParts });
    }
    for (const p of paires) {
      const { total, unite, combien, n, versUnite, versTotal } = p;
      const versParts = () => {
        if (total.value === '' || !(num(unite.value) > 0)) return false;
        combien.value = String(
          Math.round((num(total.value) / num(unite.value)) * 10000) / 10000);
        for (const autre of paires) {
          if (autre === p) continue;
          if (autre.total.value === '') autre.versTotal();
          else autre.versUnite();
        }
        p.majFormule();
        return true;
      };
      unite.addEventListener('input', () => {
        if (p.deduitParts && total.value !== '') { versParts(); return; }
        if (n() <= 0 && versParts()) return;
        versTotal();
      });
      total.addEventListener('input', () => {
        if (n() <= 0 && versParts()) return;
        versUnite();
      });
      combien.addEventListener('input', versUnite);
      versUnite();
    }

    const premier = $('#modalBody').querySelector('input, select');
    focusChamp(premier);

    const fermer = v => {
      masquerModal(m);      $('#modalClose').onclick = null;
      m.onkeydown = null;
      resolve(v);
    };
    const valeurs = () => {
      const out = {};
      for (const c of champs) {
        const el = $(`#f_${c.cle}`);
        if (!el || el.closest('.field')?.hidden) continue;
        /* Un champ nombre VIDE rend la chaine vide, et non zero.

           `num('')` vaut zero : un champ traverse sans rien taper arrivait donc
           chez l'appelant comme un zero declare, et `estDeclare` y lisait vrai.
           Toute la convention « vide n'est pas zero » tombait a cet endroit
           precis, avant meme d'atteindre le code qui la respecte.

           Rien ne change pour les lecteurs : `num('')` vaut toujours zero, et
           `vide()` compte deja la chaine vide comme vide. Seul `estDeclare` voit
           enfin la difference. */
        out[c.cle] = c.type === 'case' ? el.checked
          : c.type === 'nombre' ? (el.value === '' ? '' : num(el.value))
          : el.value.trim();
      }
      return out;
    };
    const lire = (suite = false) => {
      const out = valeurs();
      /* Une ligne qu'on efface n'a plus de champ obligatoire.

         Un champ obligatoire garantit qu'on ne cree pas une ligne muette. Il
         n'a rien a garantir sur une ligne qui ne sera plus la.

         La regle vit ici et non chez les appelants : les trois fenetres qui
         portent cette case lisent toutes `v.supprimer`, ce nom est donc deja le
         contrat entre elles et `askForm`. La quatrieme l'aurait oublie. */
      const efface = champs.some(c => c.type === 'case' && c.cle === 'supprimer') && out.supprimer;
      /* Ce qu'est un champ vide, par type. `String(0).trim()` vaut « 0 », donc
         non vide : un montant declare obligatoire passait la garde a zero, et
         la ligne s'enregistrait sans montant. Zero reste une valeur legitime
         partout ailleurs -- un versement mensuel a zero est un choix -- c'est
         `requis` qui decide, jamais le type tout seul. */
      const vide = c => {
        const v = out[c.cle];
        if (c.type === 'nombre') return !num(v);
        if (c.type === 'case') return !v;
        return !String(v ?? '').trim();
      };
      /* `requis` accepte une FONCTION des valeurs saisies : une quantite decide
         qu'un prix de revient devient obligatoire, et cette dependance ne peut
         pas se decider au moment ou le champ est construit. Un booleen reste un
         booleen, la lecture est la meme pour les deux. */
      const estRequis = c => typeof c.requis === 'function' ? c.requis(out) : c.requis;
      const manquant = efface ? null : champs.find(c => estRequis(c) && vide(c));
      if (manquant) { $(`#f_${manquant.cle}`).focus(); toast(`${manquant.label}${deuxPoints()} ${trad('à remplir')}`); return; }
      /* UN NOMBRE INVRAISEMBLABLE NE PASSE PAS LA PORTE. `type="number"` refuse
         les lettres mais laisse entrer « 5e26 », et `num()` le lit sans
         broncher : une quantite a dix puissance vingt-six a fait naitre une
         ligne de quatre cent quatre-vingt-dix-neuf quintillions d'euros. On
         lit la VALEUR BRUTE du champ, pas `out` : `valeurs()` a deja fait
         passer la chaine par `num()`, qui rend zero pour tout ce qu'il ne
         comprend pas, et zero est vraisemblable. */
      const absurde = efface ? null : champs.find(c => c.type === 'nombre'
        && !nombreValide($(`#f_${c.cle}`)?.value, c.genre || genreDeCle(c.cle)));
      if (absurde) {
        const el = $(`#f_${absurde.cle}`);
        el.focus(); el.setAttribute('aria-invalid', 'true');
        toast(`${trad(absurde.label)}${deuxPoints()} ${trad('cette valeur semble anormalement élevée, vérifie le montant saisi')}`);
        return;
      }
      /* Une regle qui porte sur DEUX champs ne peut pas vivre dans l'un des
         deux : « le capital emprunte doit etre superieur a zero quand un capital
         restant est renseigne » regarde les deux a la fois. `valide` rend le
         message a dire, ou rien. La fenetre reste ouverte, comme pour un champ
         obligatoire vide. */
      const souci = efface ? null : valide?.(out);
      if (souci) {
        if (souci.cle) $(`#f_${souci.cle}`)?.focus();
        toast(souci.message || souci);
        return;
      }
      if (suite) out.__encore = true;
      fermer(out);
    };

    /* La visibilite se calcule APRES `valeurs()`, jamais avant : `majVisibles`
       la lit, et une constante n'existe pas avant sa ligne. Appelee plus haut,
       elle levait une erreur de zone morte et la fenetre ne s'ouvrait pas.
       Et avant `depart` : un champ masque ne se lit pas, donc l'etat initial
       doit deja tenir compte de ce qui est cache, sans quoi la fenetre se
       croirait sale des son ouverture. */
    const calcules = champs.filter(c => typeof c.calcul === 'function');
    const majCalculs = () => {
      if (!calcules.length) return;
      const out = valeurs();
      for (const c of calcules) {
        const el = $(`#c_${c.cle}`);
        if (el) el.textContent = c.calcul(out);
      }
    };
    const majDerives = () => { majVisibles(); majCalculs(); };
    majDerives();
    $('#modalBody').addEventListener('input', majDerives);
    $('#modalBody').addEventListener('change', majDerives);

    /* L'etat de depart, releve apres le cablage des champs lies : `majCible()`
       reconstruit la liste dependante et peut changer sa valeur, le relever
       avant aurait rendu la fenetre sale des son ouverture. */
    const depart = JSON.stringify(valeurs());

    /*       La question vit ici, dans `askForm`, et non dans chaque appelant : il y a
       une dizaine de fenetres de ce type, et la onzieme aurait oublie de poser
       la question. Elle ne se pose que si quelque chose a change : retaper la
       meme valeur ne salit rien, et une question qui revient sans raison
       s'apprend a fermer sans lire. */
    const annulerOuDemander = async () => {
      if (JSON.stringify(valeurs()) === depart) { fermer(null); return; }
      const garder = await askConfirm(trad('Modifications non enregistrées') + '\n'
        + trad('Ce que tu viens de saisir n’est pas encore dans tes données.'),
        { ok: 'Enregistrer et fermer', refus: 'Fermer sans enregistrer', danger: false });
      if (garder) lire(); else fermer(null);
    };

    m.onkeydown = e => {
      if (e.key === 'Enter' && e.target.tagName !== 'SELECT') { e.preventDefault(); lire(); }
      if (e.key === 'Escape') { e.stopPropagation(); annulerOuDemander(); }
    };
    $('#frmCancel').onclick = annulerOuDemander;
    $('#modalClose').onclick = annulerOuDemander;
    /* La lambda n'est pas une precaution de style : `onclick = lire` passerait
       l'evenement de clic en premier argument, donc un objet toujours vrai a la
       place du drapeau d'enchainement. Chaque « Enregistrer » aurait rouvert la
       fenetre. */
    $('#frmOk').onclick = () => lire();
    if (encore) $('#frmEncore').onclick = () => lire(true);
  });
}

function askChoice(titre, message, options, valeur) {
  return new Promise(resolve => {
    const m = $('#modal');
    apercuOuvert = null;
    $('#modalTitle').textContent = titre;
    $('#modalSub').textContent = message || '';
    $('#modalBody').innerHTML = `
      <div class="modal-champs">
        <div class="field">
          <select id="chxVal" size="1">
            ${options.map(([v, l]) =>
              `<option value="${esc(String(v))}" ${String(v) === String(valeur) ? 'selected' : ''}>${esc(trad(l))}</option>`).join('')}
          </select>
        </div>
      </div>`;
    $('#modalFoot').innerHTML =
      `<button class="btn ghost" id="chxCancel" type="button">${trad('Annuler')}</button>
       <button class="btn" id="chxOk" type="button">${trad('Valider')}</button>`;
    montrerModal(m);
    const champ = $('#chxVal');
    focusChamp(champ);

    const fermer = v => {
      masquerModal(m);      $('#modalClose').onclick = null;
      resolve(v);
    };
    $('#chxCancel').onclick = () => fermer(null);
    $('#modalClose').onclick = () => fermer(null);
    $('#chxOk').onclick = () => fermer(Number(champ.value));
    champ.ondblclick = () => fermer(Number(champ.value));
  });
}

/* `refus` : le libelle du bouton de refus. Il valait « Annuler » en dur, ce qui
   se lit mal des que la question n'est pas « faire ou ne pas faire » — devant
   « Enregistrer et fermer », « Annuler » veut dire « annuler la fermeture », alors
   que le refus ferme quand meme, sans enregistrer. Un choix a deux issues nommees.

   `refus` et non `non` : `non` est deja le bouton lui-meme, quelques lignes plus
   bas. Le parametre s'est fait masquer par lui, et le libelle affiche etait
   « [object HTMLButtonElement] ». Meme piege que `aideTexte`, note ailleurs dans
   ce fichier. */
function askConfirm(texte, { danger = true, ok = 'Confirmer', refus = 'Annuler' } = {}) {
  /* `ponct()` retire l'espace avant un « ? » en anglais : la question se compose
     d'un morceau traduit et du signe, ecrit dans le gabarit, donc hors de la clef. */
  const [titre, ...suite] = ponct(String(texte)).split('\n');
  const message = suite.join('\n').trim();
  return new Promise(resolve => {
    const m = $('#confirm'), oui = $('#confirmYes'), non = $('#confirmNo');
    $('#confirmTitle').textContent = titre;
    $('#confirmMsg').innerHTML = escMontant(message).replace(/\n/g, '<br>');
    $('#confirmMsg').hidden = !message;
    oui.textContent = trad(ok);
    oui.className = 'btn' + (danger ? ' danger' : '');
    non.textContent = trad(refus);
    montrerModal(m);
    oui.focus({ preventScroll: true });

    const fermer = v => {
      masquerModal(m);
      oui.onclick = non.onclick = m.onclick = null;
      document.removeEventListener('keydown', touche, true);
      resolve(v);
    };
    /* FERMER N'EST PAS REFUSER. Echap et le fond rendent `null`, le second
       bouton rend `false` : tous les appelants testent la verite, donc rien ne
       change pour eux, et celui qui distingue un refus d'une simple fermeture
       peut le faire. Le premier a en avoir besoin : la fenetre d'avant le
       premier releve, dont le second bouton mene a une autre page. */
    const touche = e => {
      if (e.key === 'Escape') { e.stopPropagation(); fermer(null); }
      if (e.key === 'Enter') { e.preventDefault(); fermer(true); }
    };
    oui.onclick = () => fermer(true);
    non.onclick = () => fermer(false);
    m.onclick = e => { if (e.target === m) fermer(null); };
    document.addEventListener('keydown', touche, true);
  });
}

/* --- OU VA LE PRODUIT D'UNE CESSION ----------------------------------------

   Un seul composant pour toutes les fenetres de vente et de cession ; la
   logique vit dans le modele (`destinationAuto`, `cashTargets`), la fenetre ne
   fait que la montrer.

   Quand le compte qui portait l'actif a sa poche de cash, il n'y a rien a
   demander : le produit d'une vente reste chez le courtier, et la fenetre le
   dit. Sinon, une case cochee par defaut et le compte a alimenter ; decochee,
   le produit ne va sur aucun compte suivi, et la fenetre le dit aussi. */
function optionsDeParts(comptes, { credit = false } = {}) {
  const out = [];
  for (const c of comptes) {
    if (!c) continue;
    const nom = sousNom('', nomCompteV2(c), nomEtabDe(c));
    const sugg = partieSuggeree(c.id, { credit });
    const ps = partiesDeCash(c.id).filter(x => !x.ambigue && !x.archive)
      .sort((a, b) => (b.partie === sugg) - (a.partie === sugg));
    for (const x of ps)
      out.push([`${c.id}|${x.partie}`, `${nom} · ${AFFECTATION_LABEL[x.partie] || trad('Solde')} (${fmtEUR(x.montant)})`]);
    if (credit && sugg && /\+$/.test(sugg))
      out.push([`${c.id}|${sugg}`, `${nom} · ${AFFECTATION_LABEL[sugg.slice(0, -1)] || sugg.slice(0, -1)} (${trad('nouvelle part')})`]);
  }
  return out;
}
const PART_A_CHOISIR = '?';
function listeDeParts(comptes, compteDefaut, opts = {}) {
  const options = optionsDeParts(comptes, opts);
  let valeur = partieProposee(compteDefaut, opts);
  if (!valeur || !options.some(([v]) => v === valeur)) {
    options.unshift([PART_A_CHOISIR, trad('Choisis une part')]);
    valeur = PART_A_CHOISIR;
  }
  return { options, valeur };
}
const lirePart = v => {
  const [compteId, partie] = String(v || '').split('|');
  return compteId && partie ? { compteId, partie } : null;
};
const partieProposee = (compteId, opts) => {
  const s = compteId ? partieSuggeree(compteId, opts) : null;
  return s ? `${compteId}|${s}` : '';
};
const destinationDe = v => {
  const p = lirePart(v);
  return { cashAccount: p ? p.compteId : '', cashPart: p ? p.partie : '' };
};
function erreurDeFenetre(message) {
  let e = $('#fenetreErreur');
  if (!e) {
    e = document.createElement('p');
    e.id = 'fenetreErreur'; e.className = 'down'; e.setAttribute('role', 'alert');
    $('#modalBody').appendChild(e);
  }
  e.textContent = message;
  e.scrollIntoView({ block: 'nearest' });
}

function champDestination(prefixe, sourceId) {
  const auto = destinationAuto(sourceId);
  const sugg = auto ? partieSuggeree(auto, { credit: true }) : null;
  if (auto && sugg && optionsDeParts([compteById(auto)], { credit: true }).length <= 1) {
    const c = compteById(auto);
    return `
        <div class="field" data-dest-auto="${esc(auto + '|' + sugg)}"><label>${trad('Le produit va sur')}</label>
          <p class="dest-auto">${esc(sousNom('', nomCompteV2(c), nomEtabDe(c)))} · ${
            esc(AFFECTATION_LABEL[sugg.replace(/\+$/, '')] || '')}</p>
          <span class="hint">${trad('le cash du compte qui portait la ligne')}</span></div>`;
  }
  const cibles = auto ? [compteById(auto)] : cashTargets();
  const { options: opts, valeur: defaut } = listeDeParts(cibles, auto || defaultCashTarget(sourceId), { credit: true });
  if (!opts.some(([v]) => v !== PART_A_CHOISIR)) return `
        <p class="hint" data-dest-aucune>${trad('Aucun compte de liquidités n’est suivi : le produit ne sera ajouté à aucun compte.')}</p>`;
  return `
        <label class="field-case">
          <input type="checkbox" id="${prefixe}Alim" checked>
          <span>${trad('Alimenter un compte suivi')}</span>
        </label>
        <div class="field" id="${prefixe}DestChamp"><label>${trad('Compte à alimenter')}</label>
          <select id="${prefixe}Cash">${opts.map(([v, l]) =>
            `<option value="${esc(v)}" ${v === defaut ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
        <p class="hint" id="${prefixe}Hors" hidden>${trad('Le produit ne sera pas ajouté à un compte suivi par Longward.')}</p>`;
}

function cablerDestination(prefixe, apres = () => {}) {
  const cb = $(`#${prefixe}Alim`);
  if (!cb) return;
  cb.onchange = () => {
    $(`#${prefixe}DestChamp`).hidden = !cb.checked;
    $(`#${prefixe}Hors`).hidden = cb.checked;
    apres();
  };
}

function lireDestination(prefixe) {
  const auto = $('#modalBody [data-dest-auto]');
  if (auto) return auto.dataset.destAuto;
  const cb = $(`#${prefixe}Alim`);
  return cb && cb.checked ? ($(`#${prefixe}Cash`)?.value || '') : '';
}

function phraseEffetCession({ credite, produit, sortie }) {
  const effet = round2((credite ? num(produit) : 0) - num(sortie));
  if (!credite && num(produit)) return trad('Ton patrimoine suivi baisse de {v} : le produit sort de Longward.')
    .replace('{v}', fmtEUR0(Math.abs(effet)));
  if (Math.abs(effet) < 1) return trad('Ton patrimoine ne bouge pas : la valeur passe de la ligne au cash.');
  return trad('Effet sur ton patrimoine : {v}, l’écart entre le montant reçu et la dernière valeur connue.')
    .replace('{v}', fmtSigned(effet));
}

function askCession(compteId, index) {
  return new Promise(resolve => {
    const c = compteById(compteId);
    const l = c && (c.lignes || [])[index];
    if (!l) { resolve(null); return; }
    const t = typeCompte(c.type);
    const m = $('#modal');
    apercuOuvert = null;

    const aParts = !!t.parts && num(l.parts) > 0;
    const prete = !!t.prete;
    const valeur = num(l.valeur) * (partDetention(l) || 1);

    $('#modalTitle').textContent = trad(prete ? 'Remboursement ou défaut'
      : aParts ? 'Céder des parts' : 'Vendre ce placement');
    $('#modalSub').textContent = trad(prete
      ? 'Le résultat est calculé sur ce que tu avais prêté'
      : 'Le résultat est calculé sur ton prix de revient');

    $('#modalBody').innerHTML = `
      <div class="modal-champs">
        ${!prete ? '' : `
        <div class="field"><label>${trad('Que s’est-il passé ?')}</label>
          <select id="ceNature">
            <option value="remboursement">${trad('Remboursé, en tout ou en partie')}</option>
            <option value="defaut">${trad('En défaut : ce qui rentre est perdu')}</option>
          </select></div>`}
        ${!aParts ? '' : `
        <div class="field"><label>${trad('Parts cédées')}</label>
          <input type="number" step="any" id="ceParts" value="${num(l.parts)}" autocomplete="off">
          <span class="hint">${trad('tu en détiens {n} : laisse le total pour tout céder')
            .replace('{n}', fmtNombre(num(l.parts)))}</span></div>`}
        ${!prete ? '' : `
        <div class="field" data-cession="remboursement"><label>${trad('Capital remboursé ({dev})')}</label>
          <input type="number" step="any" id="ceCapital" value="${round2(valeur)}" autocomplete="off">
          <span class="hint">${trad('le nominal qui revient, hors intérêts : laisse le total pour un remboursement final')}</span></div>`}
        <div class="field"><label>${trad('Montant reçu ({dev})')}</label>
          <input type="number" step="any" id="ceProduit" value="${round2(valeur)}" autocomplete="off">
          <span class="hint">${trad(prete
            ? 'capital et intérêts compris, tel qu’il est arrivé sur ton compte'
            : 'net de frais, tel qu’il est arrivé sur ton compte')}</span></div>
        <div class="field"><label>${trad('Date')}</label>
          <input type="date" id="ceDate" value="${todayISO()}"></div>
        ${champDestination('ce', c.id)}
        <div class="field"><label>${trad('Note')}</label>
          <input id="ceNote" placeholder="${trad('Pourquoi cette cession ?')}" autocomplete="off"></div>
      </div>
      <div id="ceApercu" style="margin-top:4px"></div>`;
    $('#modalFoot').innerHTML =
      `<button class="btn ghost" id="ceCancel" type="button">${trad('Annuler')}</button>
       <button class="btn" id="ceOk" type="button">${trad('Enregistrer')}</button>`;
    montrerModal(m);

    const nature = () => (prete ? $('#ceNature').value : 'vente');
    const saisie = () => ({
      parts: aParts ? num($('#ceParts').value) : undefined,
      produit: num($('#ceProduit').value),
      capital: prete && nature() === 'remboursement' ? num($('#ceCapital').value) : undefined,
    });

    let natureVue = nature();
    const majNature = () => {
      $('#modalBody').querySelectorAll('[data-cession]').forEach(el => {
        el.hidden = el.dataset.cession !== nature();
      });
      if (nature() === natureVue) return;
      natureVue = nature();
      $('#ceProduit').value = natureVue === 'defaut' ? 0 : round2(valeur);
    };

    const majApercu = () => {
      const a = apercuCession(l, t, saisie());
      const trop = aParts && num($('#ceParts').value) > num(l.parts);
      $('#ceOk').disabled = trop || !(a.fraction > 0);
      if (trop) {
        $('#ceApercu').innerHTML = `<div class="note">⚠ <span>${
          trad('Tu n’en détiens que {n}.').replace('{n}', fmtNombre(num(l.parts)))}</span></div>`;
        return;
      }
      if (!(a.fraction > 0)) {
        $('#ceApercu').innerHTML = `<div class="note">⚠ <span>${
          trad('Indique ce qui sort : sans cela il n’y a rien à enregistrer.')}</span></div>`;
        return;
      }
      const gain = a.realised;
      const inconnu = gain === null;
      const bon = inconnu || gain >= 0;
      const mot = trad(inconnu ? 'Produit encaissé' : prete && nature() === 'defaut' ? 'Perte'
        : bon ? 'Plus-value réalisée' : 'Moins-value réalisée');
      const reste = a.totale ? trad('Le placement sort du patrimoine.')
        : trad('Il reste {r}.').replace('{r}',
            (aParts ? `${fmtNombre(a.partsRestantes)} ${trad('parts')}, ` : '')
            + fmtEUR(round2(valeur - a.sortie)));
      $('#ceApercu').innerHTML = `<div class="note" style="${inconnu ? '' : bon
        ? 'background:color-mix(in oklab, var(--good) 12%, var(--surface-1)); border-color:color-mix(in oklab, var(--good) 38%, transparent)'
        : 'background:color-mix(in oklab, var(--critical) 10%, var(--surface-1)); border-color:color-mix(in oklab, var(--critical) 34%, transparent)'}">
          ${inconnu ? '' : bon ? '↗' : '↘'}
          <span><b>${mot} ${trad('de')} ${inconnu ? fmtEUR(a.produit) : fmtSigned(gain)}${
            a.pct == null ? '' : ` · ${fmtSignedPct(a.pct)}`}</b><br>
          ${inconnu ? trad('Prix de revient non renseigné : aucune plus-value n’est calculée.')
            : trad('Sur {m} investis.').replace('{m}', fmtEUR(a.investi))} ${esc(reste)}<br>
          ${esc(phraseEffetCession({ credite: !!lireDestination('ce'), produit: a.produit, sortie: a.sortie }))}</span>
        </div>`;
    };
    cablerDestination('ce', () => majApercu());

    $('#modalBody').addEventListener('input', () => { majNature(); majApercu(); });
    $('#modalBody').addEventListener('change', () => { majNature(); majApercu(); });
    majNature(); majApercu();

    const fermer = v => { masquerModal(m); $('#modalClose').onclick = null; resolve(v); };
    $('#ceCancel').onclick = () => fermer(null);
    $('#modalClose').onclick = () => fermer(null);
    $('#ceOk').onclick = () => {
      const s = saisie();
      const a = apercuCession(l, t, s);
      if (!(a.fraction > 0)) return;
      const v = { ...s, produit: $('#ceProduit').value, nature: nature(), ...destinationDe(lireDestination('ce')),
                  date: $('#ceDate').value, note: $('#ceNote').value.trim() };
      if (lireDestination('ce') === PART_A_CHOISIR) { erreurDeFenetre(trad('Choisis la part qui reçoit le produit.')); return; }
      const erreur = verifierCession({ compteId, index, ...v });
      if (erreur) { erreurDeFenetre(erreur); return; }
      fermer(v);
    };
  });
}

function askSale(indexInitial) {
  return new Promise(resolve => {
    const m = $('#modal');
    apercuOuvert = null;
    const ps = Store.state.positions;
    const sansLigne = !ps.length;

    $('#modalTitle').textContent = trad('Vendre une ligne');
    $('#modalSub').textContent = trad('La plus-value est calculée sur ton prix de revient');
    $('#modalBody').innerHTML = `
      <div class="modal-champs">
        <div class="field"><label>${trad('Ligne')}</label>
          <select id="vePos">${ps.map((p, i) =>
            `<option value="${i}" ${!sansLigne && i === (indexInitial ?? 0) ? 'selected' : ''}>${esc(p.name)}, ${num(p.qty)} × ${fmtCur(num(p.price), p.currency)}</option>`).join('')}<option
            value="passee" ${sansLigne ? 'selected' : ''}>${trad('Une vente passée, pour mémoire')}</option></select></div>
        <div class="field" data-vente="passee" hidden><label>${trad('Titre vendu')}</label>
          <input id="vePasNom" maxlength="${NOM_LIGNE_MAX}" autocomplete="off"
                 placeholder="${trad('ex. Total, vendu sur l’ancien PEA')}" style="text-align:left"></div>
        <div class="field" data-vente="reelle"><label>${trad('Nombre d\'actions vendues')}</label>
          <input type="number" step="any" id="veQty" autocomplete="off">
          <span class="hint" id="veDispo"></span></div>
        <div class="field" data-vente="reelle"><label>${trad('Prix de vente unitaire')}</label>
          <input type="number" step="any" id="vePrice" autocomplete="off">
          <span class="hint" id="veDev"></span>
          <span class="hint" id="veVieux" hidden></span></div>
        <div class="field" data-vente="reelle" id="veFxWrap" hidden><label>${trad('Taux de change à la vente')}</label>
          <input type="number" step="any" id="veFx" autocomplete="off">
          <span class="hint">${trad('1 unité de devise = ce montant en euros')}</span></div>
        <div class="field" data-vente="passee" hidden><label>${trad('Montant encaissé ({dev})')}</label>
          <input type="number" step="any" id="vePasGross" autocomplete="off"></div>
        <div class="field" data-vente="passee" hidden><label>${trad('Plus ou moins-value réalisée ({dev})')}</label>
          <input type="number" step="any" id="vePasPnl" autocomplete="off">
          <span class="hint">${trad('négative si la vente a perdu : le prix de revient s’en déduit')}</span></div>
        <div class="field"><label>${trad('Date')}</label>
          <input type="date" id="veDate" value="${todayISO()}">
          <span class="hint" data-vente="passee" hidden>${trad('même approximative : elle range la vente dans son année')}</span></div>
        <div id="veDest" data-vente="reelle"></div>
        <div class="field"><label>${trad('Note')}</label>
          <input id="veNote" placeholder="${trad('Pourquoi cette vente ?')}" autocomplete="off"></div>
      </div>
      <div id="veApercu" style="margin-top:4px"></div>`;
    $('#modalFoot').innerHTML =
      `<button class="btn ghost" id="veCancel" type="button">${trad('Annuler')}</button>
       <button class="btn" id="veOk" type="button">${trad('Enregistrer la vente')}</button>`;
    montrerModal(m);

    const sel = $('#vePos'), qte = $('#veQty'), prix = $('#vePrice'), fx = $('#veFx');
    const passee = () => sel.value === 'passee';

    /* Les champs de chaque nature s'affichent ou s'effacent d'un coup. Le taux de
       change garde son propre secret : il ne se montre que sur une ligne en
       devise, donc `chargerLigne()` le decide apres, jamais celle-ci. */
    const majNature = () => {
      const p = passee();
      $('#modalBody').querySelectorAll('[data-vente]').forEach(el => {
        el.hidden = el.dataset.vente !== (p ? 'passee' : 'reelle');
      });
      if (p) $('#veFxWrap').hidden = true;
      $('#modalTitle').textContent = p ? trad('Déclarer une vente passée') : trad('Vendre une ligne');
      $('#modalSub').textContent = p
        ? trad('Pour mémoire : rien d’autre ne bouge, ni cash ni patrimoine')
        : 'La plus-value est calculée sur ton prix de revient';
      $('#veOk').textContent = p ? trad('Ajouter au journal') : trad('Enregistrer la vente');
    };

    const chargerLigne = () => {
      majNature();
      if (passee()) { majApercuVente(); return; }
      const p = ps[+sel.value];
      qte.value = num(p.qty);
      qte.max = num(p.qty);
      prix.value = num(p.price);
      $('#veDispo').innerHTML = `${num(p.qty)} en portefeuille · prix de revient ${fmtCur(num(p.buyPrice), p.currency)}`;
      const devise = p.currency || 'EUR';
      $('#veDev').textContent = devise === 'EUR' ? 'en euros' : `en ${devise}`;
      $('#veFxWrap').hidden = devise === deviseBase();
      fx.value = num(p.fx) || 1;
      $('#veDest').innerHTML = champDestination('ve', p.account);
      cablerDestination('ve', () => majApercuVente());
      majApercuVente();
      avisCoursDuJour();
    };

    const majApercuVente = () => {
      if (passee()) {
        const nom = $('#vePasNom').value.trim();
        const pnl = num($('#vePasPnl').value);
        $('#veOk').disabled = !nom;
        $('#veApercu').innerHTML = !nom
          ? `<div class="note">⚠ <span>${trad('Indique le titre vendu.')}</span></div>`
          : `<div class="note" style="${pnl >= 0
              ? 'background:color-mix(in oklab, var(--good) 12%, var(--surface-1)); border-color:color-mix(in oklab, var(--good) 38%, transparent)'
              : 'background:color-mix(in oklab, var(--critical) 10%, var(--surface-1)); border-color:color-mix(in oklab, var(--critical) 34%, transparent)'}">
              ${pnl >= 0 ? '↗' : '↘'}
              <span><b>${trad(pnl >= 0 ? 'Plus-value de {m}' : 'Moins-value de {m}').replace('{m}', () => fmtSigned(pnl))}</b><br>
              ${trad('Au journal seulement : ni cash, ni position, ni patrimoine ne bougent.')}</span>
            </div>`;
        return;
      }
      const p = ps[+sel.value];
      const a = salePreview(p, qte.value, prix.value, $('#veFxWrap').hidden ? 1 : fx.value);
      const trop = a.qty > num(p.qty), nul = a.qty <= 0;
      $('#veOk').disabled = trop || nul;
      if (trop || nul) {
        $('#veApercu').innerHTML = `<div class="note">⚠ <span>${trop
          ? trad(num(p.qty) > 1 ? 'Tu n’as que {n} actions sur cette ligne.' : 'Tu n’as que {n} action sur cette ligne.')
              .replace('{n}', num(p.qty))
          : trad('Indique combien d’actions tu vends.')}</span></div>`;
        return;
      }
      if (a.realised == null) {
        $('#veApercu').innerHTML = `<div class="note">ⓘ <span><b>${trad('Résultat non calculable : prix de revient non renseigné')}</b><br>
          ${trad('Encaissé')} ${fmtEUR(a.gross)}<br>
          ${esc(phraseEffetCession({ credite: !!lireDestination('ve'), produit: a.gross,
            sortie: num(p.qty) > 0 ? posValue(p) * a.qty / num(p.qty) : 0 }))}</span></div>`;
        return;
      }
      const gagnant = a.realised >= 0;
      $('#veApercu').innerHTML = `
        <div class="note" style="${gagnant
          ? 'background:color-mix(in oklab, var(--good) 12%, var(--surface-1)); border-color:color-mix(in oklab, var(--good) 38%, transparent)'
          : 'background:color-mix(in oklab, var(--critical) 10%, var(--surface-1)); border-color:color-mix(in oklab, var(--critical) 34%, transparent)'}">
          ${gagnant ? '↗' : '↘'}
          <span><b>${trad(gagnant ? 'Plus-value de {m}' : 'Moins-value de {m}').replace('{m}', () => fmtSigned(a.realised))}</b>
          (${fmtSignedPct(a.pct)})<br>
          ${trad('Encaissé {m} · prix de revient {p}').replace('{m}', () => fmtEUR(a.gross)).replace('{p}', () => fmtEUR(a.invested))}<br>
          ${a.full ? trad('La ligne sera retirée du tableau, la vente reste au journal.')
                   : trad(a.remaining > 1 ? 'Il te restera {n} actions.' : 'Il te restera {n} action.')
                       .replace('{n}', roundQty(a.remaining))}<br>
          ${esc(phraseEffetCession({ credite: !!lireDestination('ve'), produit: a.gross,
            sortie: num(p.qty) > 0 ? posValue(p) * a.qty / num(p.qty) : 0 }))}</span>
        </div>`;
    };

    sel.onchange = chargerLigne;
    const avisCoursDuJour = () => {
      const avis = $('#veVieux');
      if (!avis) return;
      const p = ps[+sel.value];
      const recule = !passee() && $('#veDate').value && $('#veDate').value < todayISO();
      if (!recule || !p) { avis.hidden = true; return; }
      const auJour = num(p.price);
      const saisi = num(prix.value);
      avis.hidden = false;
      avis.textContent = Math.abs(saisi - auJour) < 1e-9
        ? `${trad('C’est le cours d’aujourd’hui, pas celui de cette date. Corrige-le, ou choisis « une vente passée » : elle demande le montant encaissé, qui ne vieillit pas.')}`
        : trad('Prix saisi à la main : l’application ne le compare plus au cours du jour.');
    };
    for (const el of [qte, prix, fx, $('#vePasNom'), $('#vePasGross'), $('#vePasPnl')])
      el.oninput = () => { majApercuVente(); avisCoursDuJour(); };
    $('#veDate').oninput = avisCoursDuJour;
    chargerLigne();
    if (passee()) focusChamp($('#vePasNom'));
    else { focusChamp(qte); qte.select(); }

    const fermer = v => {
      masquerModal(m);      $('#modalClose').onclick = null;
      resolve(v);
    };
    $('#veCancel').onclick = () => fermer(null);
    $('#modalClose').onclick = () => fermer(null);
    $('#veOk').onclick = () => {
      if (passee()) {
        const name = $('#vePasNom').value.trim();
        const v = {
          passee: true, name,
          gross: $('#vePasGross').value, realised: $('#vePasPnl').value,
          date: $('#veDate').value, note: $('#veNote').value.trim(),
        };
        const erreur = verifierDeclaration(v);
        if (erreur) { erreurDeFenetre(erreur); return; }
        fermer(v);
        return;
      }
      const p = ps[+sel.value];
      const a = salePreview(p, qte.value, prix.value, $('#veFxWrap').hidden ? 1 : fx.value);
      if (a.qty <= 0 || a.qty > num(p.qty)) return;
      const v = {
        index: +sel.value, qty: a.qty, price: prix.value,
        fxSell: $('#veFxWrap').hidden ? 1 : num(fx.value),
        ...destinationDe(lireDestination('ve')), date: $('#veDate').value, note: $('#veNote').value.trim(),
      };
      if (lireDestination('ve') === PART_A_CHOISIR) { erreurDeFenetre(trad('Choisis la part qui reçoit le produit.')); return; }
      const erreur = verifierVente(v);
      if (erreur) { erreurDeFenetre(erreur); return; }
      fermer(v);
    };
  });
}

function askPosition(index) {
  return new Promise(resolve => {
    const p = Store.state.positions[index];
    if (!p) { resolve(null); return; }
    const dev = p.currency || 'EUR';
    const m = $('#modal');
    apercuOuvert = null;

    const ligne = (label, valeur, classe) =>
      `<dt>${label}</dt><dd class="${classe || ''}">${valeur}</dd>`;

    /* `data-differe` : rien de ce qui est saisi ici n'entre dans l'etat avant
       « Enregistrer ». Voir l'ecouteur des champs, plus bas dans ce fichier. */
    $('#modalBody').dataset.differe = 'propre';

    /* Toute la fiche se repeint d'un seul geste, et aucun chiffre ne se
       rafraichit a la main.

       « Enregistrer » ne reprenait que deux noeuds, le montant en tete et le
       total investi. Corriger un prix de revient laissait donc la plus-value,
       sa part du portefeuille et l'ecart du jour sur les anciens chiffres, dans
       la meme fenetre et a quelques lignes d'ecart. La fiche se contredisait
       elle-meme, et c'est justement le chiffre corrige qu'on venait relire :
       deux nombres repeints sur cinq, c'est une liste recopiee a la main.

       L'en-tete en est aussi : le nom et le compte se modifient ici, et le titre
       comme le sous-titre les portent. `brancher()` repose les commandes du
       corps, qui partent avec l'ancien balisage ; celles du pied survivent, le
       pied n'etant pas repeint. */
    const peindre = () => {
      const jour = posDayChange(p);
      const marche = marketStatus(p);
      const compte = ACC[p.account];
      $('#modalTitle').textContent = p.name || 'Ligne sans nom';
      $('#modalSub').textContent = [compte?.label, ASSET_CLASSES[assetClassDe(p)],
                                    ROLES[roleDe(p)], dev].filter(Boolean).join(' · ');
      $('#modalBody').innerHTML = `
      <div class="modal-total">
        <b>${fmtEUR(posValue(p))}</b>
        <span>${num(p.qty)} × ${fmtCur(p.price, dev)}${dev !== 'EUR' ? ` · change ${round4(num(p.fx) || 1)}` : ''}</span>
      </div>
      <div class="paire-btn fiche-gestes">
        <button class="btn ghost" id="posSell" type="button">− ${trad('Vendre')}</button>
        <button class="btn ghost" id="posBuy" type="button">+ ${trad('Acheter')}</button>
      </div>

      <div class="modal-champs champs-cote" style="margin:14px 0 4px">
        <div class="field"><label>${trad('Quantité')}</label>
          <input type="number" step="any" data-path="positions.${index}.qty" value="${p.qty ?? ''}"></div>
        ${p.manual ? `
        <div class="field"><label>${trad('Prix de revient')} ({dev})</label>
          <input type="number" step="any" data-path="positions.${index}.invested" value="${p.invested ?? ''}"></div>`
        : `
        <div class="field"><label>${trad('Prix de revient unitaire')} (${esc(dev)})</label>
          <input type="number" step="any" data-path="positions.${index}.buyPrice" value="${p.buyPrice ?? ''}"></div>`}
      </div>
      ${(() => {
        const phrase = p.manual
          ? (num(p.invested) ? '' : trad('prix de revient manquant'))
          : num(p.buyPrice)
            ? `${trad('soit')} ${num(p.qty).toLocaleString(locale())} × ${fmtCur(p.buyPrice, dev)} = ${
                fmtEUR(posInvested(p))} ${trad('investis')}`
            : trad('prix de revient manquant');
        return phrase ? `
      <p class="hint" style="margin:0 0 12px">${phrase}</p>` : '';
      })()}

      ${(() => {
        const emetteur = issuerOf(p), pays = isinCountry(p.isin), r = rangePosition(p);
        const TYPES = { ETF: trad('Fonds coté (ETF)'), EQUITY: trad('Action'), MUTUALFUND: trad('Fonds'),
                        CRYPTOCURRENCY: 'Crypto', CURRENCY: trad('Devise'), INDEX: trad('Indice') };
        return `
      <dl class="kv kv-texte">
        ${ligne(trad('Nature'), p.kind ? esc(TYPES[p.kind] || p.kind)
          : `<span class="muted">${trad('inconnue, le cours ne l’a pas dit')}</span>`)}
        ${ligne('ISIN', p.isin
          ? `<span style="font-family:var(--font-nb)">${esc(p.isin)}</span>`
            + boutonCopier(p.isin, 'Copier l’ISIN')
          : (assetClassDe(p) === 'crypto' || p.manual
             ? `<span class="muted">${trad('sans objet')}</span>`
             : `<span class="muted">${trad('à copier depuis ton courtier')}${aide(trad("Aucune source gratuite ne donne l’ISIN à partir d’un symbole : Yahoo ne le publie pas, et OpenFIGI ne fait que le chemin inverse. Ton relevé de courtier le porte, et le bouton « Vérifier » plus bas confirme qu’il désigne le bon titre."))}</span>`))}
        ${ligne(trad('Pays d’émission'), pays
          ? `${esc(pays)} <span class="muted">${esc(String(p.isin).slice(0, 2))}</span>`
          : (assetClassDe(p) === 'crypto' || p.manual
             ? `<span class="muted">${trad('sans objet')}</span>`
             : `<span class="muted">${trad('se déduit de l’ISIN')}</span>`))}
        ${ligne(trad('Place'), marche
          ? `${esc(p.exchange || p.symbol || '')} <span class="muted">${marche.label}</span>`
          : (p.manual ? `<span class="muted">${trad('saisie à la main')}</span>`
                      : `<span class="muted">${trad('non résolue')}</span>`))}
        ${ligne(trad('Nom officiel'), p.longName
          ? (p.longName === p.name
             ? `<span class="muted">${trad('identique au nom de la ligne')}</span>`
             : esc(p.longName))
          : `<span class="muted">${trad('arrive avec le cours')}</span>`)}
        ${ligne(trad('Émetteur'), emetteur
          ? `${esc(emetteur)} <span class="muted">${trad('d’après le nom du fonds')}</span>`
          : `<span class="muted">${trad('se déduit du nom d’un fonds')}</span>`)}
      </dl>

      <dl class="kv" style="margin-top:12px">
        ${jour && !jour.depuisAchat ? ligne(trad('Aujourd’hui'), jour.horsSeance
            ? `<span class="muted">${trad('hors séance')}</span>`
              + (num(p.quoteTime) ? ` <span class="muted">${trad('cours')} ${esc(fmtCoursQuand(p.quoteTime))}</span>` : '')
            : `<span class="${cls(jour.eur)}">${fmtSignedPct(jour.pct, 2)}</span>`
              + ` <span class="muted">${fmtSigned(jour.eur)}</span>`) : ''}
        ${ligne(`${trad('Plus / moins-value')}${jour?.depuisAchat
            ? `<span class="sub">${trad('achetée aujourd’hui : c’est aussi ton résultat du jour')}</span>` : ''}`,
            posPerfEur(p) == null
              ? `<span class="muted">${trad('prix de revient manquant')}</span>`
              : `<span class="${cls(posPerfEur(p))}">${fmtSignedPct(posPerfPct(p), 2)}</span>`
                + ` <span class="muted">${fmtSigned(posPerfEur(p))}</span>`)}
        ${jour && num(jour.prev) ? ligne(trad('Clôture de la veille'), fmtCur(jour.prev, dev)) : ''}
        ${num(p.dayLow) && num(p.dayHigh)
          ? ligne(trad('Séance'), `${fmtCur(p.dayLow, dev)} <span class="muted">${trad('à')}</span> ${fmtCur(p.dayHigh, dev)}`) : ''}
        ${num(p.volume) ? ligne(trad('Volume du jour'), num(p.volume).toLocaleString(locale()) + ' ' + trad('titres')) : ''}
        ${ligne(`${trad('Part du portefeuille')}${aide(trad('Calculé sur la valeur totale de ton portefeuille Marchés, cash à investir inclus. Le même calcul que la colonne « Poids » de la carte du jour et que le tableau des lignes.'))}`,
            fmtPct(poidsPortefeuille(posValue(p)), 2))}
      </dl>

      <dl class="kv" style="margin-top:12px">
        <dt>${trad('Classement')}<span class="sub">${trad('déduit automatiquement')}</span></dt>
        <dd>${esc(trad(ZONES[zoneDe(p)]))} <span class="muted">·</span> ${esc(trad(SECTEURS[secteurDe(p)]))}</dd>
      </dl>

      ${r ? `<div class="an52">
        <div class="an52-tete">
          <span>${trad('Sur un an')}</span>
          <span class="muted">${fmtCur(r.bas, dev)}, ${fmtCur(r.haut, dev)}</span>
        </div>
        <div class="an52-piste"><i style="left:${r.pct.toFixed(1)}%"></i></div>
        <div class="an52-pied muted">
          ${r.pct >= 90 ? trad('proche de son plus haut de l’année')
            : r.pct <= 10 ? trad('proche de son plus bas de l’année')
            : `${trad('à')} ${Math.round(r.pct)} % ${trad('de l’amplitude annuelle')}`}
        </div>
      </div>` : ''}`;
      })()}

      <div class="modal-champs" style="margin-top:12px">
        <div class="field"><label>${trad('Nom')}${aide(
          `${NOM_LIGNE_MAX} ${trad('caractères au plus : ce nom se lit dans les colonnes de '
          + 'Marchés, où la place est comptée. Le nom officiel du titre reste plus '
          + 'haut sur cette fiche, et le bouton qui le suit le recopie ici.')}`)}</label>
          <input data-path="positions.${index}.name" maxlength="${NOM_LIGNE_MAX}"
                 value="${esc(p.name || '')}"></div>
        <div class="field"><label>${trad('Compte')}</label>
          <select data-path="positions.${index}.account">
            ${accountsWhere(a => a.holdings).map(a =>
              `<option value="${a.id}" ${a.id === p.account ? 'selected' : ''}>${esc(a.label)}</option>`).join('')}
          </select></div>
        <div class="field"><label>${trad('Classe d’actif')}</label>
          <select data-path="positions.${index}.assetClass">
            ${OPTIONS_CLASSE.map(([v, l]) => `<option value="${v}" ${v === assetClassDe(p) ? 'selected' : ''}>${esc(l)}</option>`).join('')}
          </select></div>
        <div class="field"><label>${trad('Date d’achat')}${aide(trad(DATE_ACHAT_AIDE))}</label>
          <input type="date" data-path="positions.${index}.dateAchat" value="${esc(p.dateAchat || '')}"></div>
        <div class="field"><label>${trad('Nature')}${aide(trad("Un fonds répartit le risque sur des centaines de lignes, un titre en direct le concentre sur une société. La classe d'actif ne le dit pas (un MSCI World et une action Meta sont tous deux des actions), et c'est pourtant ce qui distingue un socle d'un pari. Déduit de l'instrument, corrigeable ici."))}</label>
          <select data-path="positions.${index}.nature">
            <option value="" ${!p.nature ? 'selected' : ''}>${trad('Auto,')} ${esc(trad(NATURES[natureDe({ ...p, nature: '' })]))}</option>
            ${Object.entries(NATURES).map(([v, l]) =>
              `<option value="${v}" ${p.nature === v ? 'selected' : ''}>${esc(trad(l))}</option>`).join('')}
          </select></div>
        <div class="field"><label>${trad('Rôle')}</label>
          <select data-path="positions.${index}.role">
            ${OPTIONS_ROLE.map(([v, l]) => `<option value="${v}" ${v === roleDe(p) ? 'selected' : ''}>${esc(trad(l))}</option>`).join('')}
          </select></div>

        ${p.manual ? `
        <div class="field"><label>${trad('Valeur')} ({dev})</label>
          <input type="number" step="any" data-path="positions.${index}.value" value="${p.value ?? ''}"></div>`
        : num(p.quoteTime) ? `
        <div class="field"><label>${trad('Cours')} (${esc(dev)})</label>
          <input type="number" class="lecture" value="${p.price ?? ''}" readonly tabindex="-1"
                 aria-readonly="true"></div>`
        : `
        <div class="field"><label>${trad('Cours')} (${esc(dev)})</label>
          <input type="number" step="any" data-path="positions.${index}.price" value="${p.price ?? ''}"></div>`}
        <div class="field"><label>${trad('Valeur')}${aide(trad("Par défaut, la valeur d’une ligne est quantité × cours, et le cours se rafraîchit tout seul. « Saisie à la main » sert aux lignes qu’aucune place ne cote : une part de société, un contrat, un actif que tu valorises toi-même. Le cours cesse alors d’être interrogé."))}</label>
          <select data-path="positions.${index}.manual" data-type="bool">
            <option value="false" ${p.manual ? '' : 'selected'}>${trad('Calculée, quantité × cours')}</option>
            <option value="true" ${p.manual ? 'selected' : ''}>${trad('Saisie à la main')}</option>
          </select></div>
        <p class="hint" style="margin: -2px 0 0">${p.manual
          ? trad('Le cours n’est plus interrogé pour cette ligne.')
          : num(p.quoteTime)
            ? `${trad('cours')} ${esc(fmtCoursQuand(p.quoteTime))} · ${trad('il se met à jour tout seul')}`
            : trad('aucun cours reçu pour cette ligne : saisis-le à la main')}</p>
        <div class="field"><label>ISIN
            <button type="button" class="btn xs ghost" id="posIsinVerif"
                    style="margin-left:8px"
                    title="${trad('Vérifier la clé de contrôle, puis à quel titre ce code correspond')}">${trad('Vérifier')}</button></label>
          <input data-path="positions.${index}.isin" value="${esc(p.isin || '')}"
                 maxlength="12" style="text-transform:uppercase">
          <p class="hint" id="posIsinAvis" style="margin:8px 0 0"></p></div>
        <div class="field"><label>${trad('Symbole')}${(p.isin || '').trim() ? `
            <button type="button" class="btn xs ghost" data-action="resolve-row" data-i="${index}"
                    style="margin-left:8px"
                    title="${trad('Remplacer le symbole par celui que désigne l\'ISIN')}">${trad('↻ Depuis l\'ISIN')}</button>` : ''}</label>
          <input data-path="positions.${index}.symbol" value="${esc(p.symbol || '')}"
                 maxlength="12" style="text-transform:uppercase"></div>
      </div>

      <div class="fiche-danger">
        <button type="button" class="btn ghost danger" id="posDelete">${trad('Supprimer cette ligne')}</button>
        <p class="hint">${trad('Elle quitte le portefeuille sans passer par une vente : rien '
          + 'n’est encaissé, et aucune plus-value n’entre au journal. Pour solder en '
          + 'encaissant, c’est « Vendre ».')}</p>
      </div>`;
      brancher();
    };
    peindre();

    $('#modalFoot').innerHTML =
      `<span class="spacer"></span>
       <button class="btn" id="posSave" type="button">${trad('Enregistrer')}</button>
       <button class="btn ghost" id="posOk" type="button">${trad('Fermer')}</button>`;
    montrerModal(m);

    /* Declaree, et non posee dans un `const` : `peindre()` tourne plus haut et
       appelle `brancher()`, qui a besoin d'elle. Une fonction declaree est
       connue de toute la portee, une constante seulement apres sa ligne. */
    function fermer(v) {
      masquerModal(m);      $('#modalClose').onclick = null;
      resolve(v);
    }
    const propre = () => ($('#modalBody')?.dataset.differe || 'propre') === 'propre';
    /* Le champ du prix de revient quand il est vide alors que la ligne porte des
       titres — et `null` sinon.

       Une quantite sans prix de revient n'est pas une ligne incomplete, c'est une
       ligne MUETTE : `posPerfEur` et `posPerfPct` rendent `null` faute de base,
       donc rien de faux ne s'affiche, mais « prix de revient manquant » s'installe
       et ne partira jamais tout seul. Enregistrer ce silence, c'est le rendre
       definitif. On refuse, et on designe le champ.

       La valeur se lit dans le CHAMP et non dans l'etat : la saisie de cette fiche
       est differee, donc l'etat porte encore l'ancienne valeur au moment du
       controle. */
    const baseManquante = () => {
      const champ = $(`[data-path="positions.${index}.${p.manual ? 'invested' : 'buyPrice'}"]`);
      if (!champ) return null;
      const qte = $(`[data-path="positions.${index}.qty"]`);
      const titres = num(qte ? qte.value : p.qty);
      return titres > 0 && !num(champ.value) ? champ : null;
    };
    const enregistrer = () => {
      const manque = baseManquante();
      if (manque) {
        manque.focus();
        toast(`${trad(p.manual ? 'Prix de revient' : 'Prix de revient unitaire')}${
          deuxPoints()} ${trad('à remplir')}`);
        return false;
      }
      /* `appliquerDiffere()` : la meme fonction que les panneaux d'apercu, et la
         meme que l'ecriture a la frappe, appelee une fois pour toutes. Le corps
         de cette fiche en portait sa propre copie, a deux lignes d'ecart. */
      appliquerDiffere();
      Store.save();
      render();                     // la page derriere suit
      const y = $('#modalBody').scrollTop;
      peindre();
      $('#modalBody').scrollTop = y;
      toast(trad('Ligne enregistrée'));
      return true;
    };
    $('#posSave').onclick = enregistrer;
    const fermerOuDemander = async () => {
      if (propre()) { fermer('ferme'); return; }
      const garder = await askConfirm(trad('Modifications non enregistrées') + '\n'
        + trad('Cette ligne porte des changements qui ne sont pas encore dans tes données.'),
        { ok: 'Enregistrer et fermer', refus: 'Fermer sans enregistrer', danger: false });
      if (garder && !enregistrer()) return;
      fermer('ferme');
    };
    $('#posOk').onclick = fermerOuDemander;
    $('#modalClose').onclick = () => fermer('ferme');
    /* Les deux commandes qui vivent dans le corps de la fiche, et non dans son
       pied : elles partent a chaque peinture avec le balisage qui les portait,
       donc elles se reposent ici. Declaree pour la meme raison que `fermer`,
       `peindre()` l'appelant plus haut que sa definition. */
    function brancher() {
      $('#posSell').onclick = () => fermer({ vendre: index });
      $('#posBuy').onclick = () => fermer({ acheter: index });
      $('#posDelete').onclick = async () => {
        const ok = await askConfirm(`${trad('Supprimer')} ${guill(p.name || trad('cette ligne'))} ?\n`
          + `${num(p.qty)} × ${fmtCur(p.price, dev)}, ${trad('soit')} ${fmtEUR(posValue(p))}.\n\n`
          + trad('La ligne quitte le portefeuille sans vente : ni encaissement, ni '
          + "plus-value au journal. Réversible avec Ctrl+Z, et une sauvegarde du "
          + "jour existe dans l'onglet Données."), { ok: 'Supprimer', danger: true });
        if (!ok) return;
        fermer({ supprimer: index });
      };

      const avis = $('#posIsinAvis');
      const champIsin = $(`#modalBody [data-path="positions.${index}.isin"]`);
      const dire = (texte, ton) => {
        avis.className = `hint ${ton || ''}`;
        avis.innerHTML = texte;
      };
      $('#posIsinVerif').onclick = async () => {
        const saisi = (champIsin.value || '').trim().toUpperCase();
        if (!saisi) { dire('Aucun ISIN à vérifier sur cette ligne.'); return; }

        const corrige = isinCorrige(saisi);
        if (!cleIsin(saisi)) {
          dire(`<b>${esc(saisi)}</b> n'a pas la forme d'un ISIN : deux lettres de pays,
                neuf caractères, puis une clé de contrôle.`, 'down');
          return;
        }
        let code = saisi;
        if (corrige) {
          code = corrige;
          champIsin.value = code;
          champIsin.dispatchEvent(new Event('change', { bubbles: true }));
          dire(`Clé de contrôle corrigée : <b>${esc(saisi)}</b> devient
                <b>${esc(code)}</b>. Vérification du titre…`);
        } else {
          dire('Clé de contrôle valide. Vérification du titre…');
        }

        try {
          const r = await Quotes.resolveIsin(code);
          const best = r && r.best;
          if (!best || !best.symbol) {
            dire(`<b>${esc(code)}</b> est bien formé, mais aucune cotation ne lui
                  répond. ${esc(r && r.error ? r.error : 'Vérifie le code auprès de ton courtier.')}`, 'down');
            return;
          }
          const p2 = Store.state.positions[index];
          const dejaBon = (p2.symbol || '').toUpperCase() === best.symbol.toUpperCase();
          if (!p2.symbol) {
            p2.symbol = best.symbol;
            Store.save();
            const champSym = $(`#modalBody [data-path="positions.${index}.symbol"]`);
            if (champSym) champSym.value = best.symbol;
          }
          dire(`<b>${esc(code)}</b> ${trad('correspond à')} <b>${esc(best.name || best.symbol)}</b>
                · ${esc(best.symbol)}${best.exchange ? ` · ${esc(best.exchange)}` : ''}.
                ${dejaBon || !p2.symbol ? '' : trad('Ta ligne porte le symbole {s} : si les '
                  + 'deux titres diffèrent, c’est l’un des deux qui est faux.')
                  .replace('{s}', `<b>${esc(p2.symbol)}</b>`)}`,
            dejaBon || !best ? 'up' : '');
        } catch (e) {
          dire(trad('Impossible de joindre la passerelle : {m}. La clé de contrôle, '
                + 'elle, est vérifiée.').replace('{m}', esc(e.message)), 'down');
        }
      };
    }
  });
}

function askBuy(index) {
  return new Promise(async resolve => {
    const p = Store.state.positions[index];
    if (!p) { resolve(null); return; }
    const comptesCash = cashTargets();
    const cashParDefaut = compteById(defaultCashTarget(p.account));
    const partsAchat = listeDeParts(comptesCash, cashParDefaut?.id);
    const dev = p.currency || 'EUR';
    const baseManque = !p.manual && num(p.qty) > 0 && !num(p.buyPrice);

    const v = await askForm({
      titre: `Acheter · ${p.name}`,
      sous: baseManque
        ? `${trad('Position actuelle')} : ${num(p.qty)} × ${trad('prix de revient manquant')}`
        : `Position actuelle : ${num(p.qty)} × ${fmtCur(p.buyPrice, dev)} de prix de revient`,
      ok: 'Acheter',
      champs: [
        { cle: 'qty', label: trad('Quantité achetée'), type: 'nombre', requis: true, exemple: '0' },
        { cle: 'price', label: `Prix unitaire (${dev})`, type: 'nombre', requis: true,
          valeur: num(p.price) || '', aide: trad('pré-rempli avec le dernier cours') },
        ...(!baseManque ? [] : [{
          cle: 'basePrice', type: 'nombre', requis: true,
          label: `${trad('Prix de revient des titres déjà détenus')} (${dev})`,
          aide: trad('Cette ligne n’en a pas encore. Sans lui, le PRU moyen après cet achat '
            + 'serait faux : indique ce que tu as payé par titre pour ceux que tu détiens déjà.'),
        }]),
        ...(comptesCash.length ? [{
          cle: 'cash', label: trad('Payé depuis'), type: 'liste',
          options: [...partsAchat.options,
                    ['', 'Aucun compte, ne pas toucher aux espèces']],
          valeur: partsAchat.valeur,
        }] : []),
      ],
      valide: x => {
        if (x.cash === PART_A_CHOISIR) return { cle: 'cash', message: trad('Choisis la part qui paie.') };
        const r = verifierAchat({ index, qty: x.qty, price: x.price, base: x.basePrice, source: lirePart(x.cash) });
        if (!r.erreur) return null;
        const cles = ['qty', 'price', ...(baseManque ? ['basePrice'] : []), ...(comptesCash.length ? ['cash'] : [])];
        return { cle: cles.includes(r.cle) ? r.cle : 'qty', message: r.erreur };
      },
    });
    if (!v || !num(v.qty)) { resolve(null); return; }
    resolve({ index, qty: num(v.qty), price: num(v.price),
              base: num(v.basePrice) || null, source: lirePart(v.cash) });
  });
}

partieChargee('assets/app-09-rendu.js');
