/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */
function fmtWhen(iso) {
  if (!iso) return trad('jamais');
  const d = new Date(iso), mins = Math.round((Date.now() - d) / 60000);
  if (mins < 1) return trad("à l'instant");
  if (mins < 60) return trad('il y a {n} min').replace('{n}', mins);
  if (mins < 1440) return trad('il y a {n} h').replace('{n}', Math.round(mins / 60));
  return d.toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' });
}

function barreEtatCours() {
  return `
  <div class="barre-etat">
    <button class="etat-cours" id="btnQuotes" type="button" data-action="refresh-quotes"
            title="${trad('Récupérer les cours de bourse')}"><i class="pt"></i><span id="coursQuand">${trad('Cours')}</span><span
            class="etat-maj" aria-hidden="true">↻</span></button>
  </div>`;
}

const COURS_FRAIS = 15 * 60 * 1000;   // en deca, on considere le cours a jour

function majEtatCours(etat) {
  const btn = $('#btnQuotes');
  if (!btn) return;
  const quand = $('#coursQuand');
  const on = Quotes.isOnline();
  const last = Store.state.quotes?.lastRun;
  const age = last ? Date.now() - new Date(last) : Infinity;

  btn.classList.remove('frais', 'tiede', 'hs', 'encours');

  if (etat === 'encours') {
    btn.classList.add('encours');
    quand.textContent = trad('Cours…');
    btn.title = trad('Récupération en cours');
    return;
  }
  if (on === false) {
    btn.classList.add('hs');
    btn.disabled = true;
    quand.textContent = trad('Hors ligne');
    btn.title = trad('Impossible de mettre à jour les cours pour le moment');
    return;
  }
  btn.disabled = false;
  if (!Quotes.plan().symbols.length) {
    quand.textContent = trad('Cours');
    btn.title = trad('Aucun symbole suivi pour l’instant');
    return;
  }
  /* Ce que la pastille date, c'est le PRIX, pas la requete.

     `coursAsOf()` donne l'heure du marche, celle que la place a mise sur le
     dernier echange. Quand elle manque — Stooq ne la publie pas — on retombe
     sur `lastRun`, qui est alors tout ce qu'on sait. */
  const marche = coursAsOf();
  const ageMarche = marche ? Date.now() - marche * 1000 : null;
  const reference = ageMarche == null ? age : ageMarche;
  btn.classList.add(reference < COURS_FRAIS ? 'frais' : 'tiede');

  /* Hors seance, la pastille dit « hors seance » plutot qu'un age.

     Elle affichait « il y a 11 h » juste apres une actualisation qui venait de
     dire « 5 cours mis a jour ». Deux signaux qui semblent se contredire, et le
     second a l'air d'annoncer une panne : on a clique, quelque chose s'est
     passe, le repere n'a pas bouge.

     Donc ni « a l'instant » ni un age : la raison. Quand aucune ligne n'a cote
     depuis minuit, la place est fermee, et « hors seance » est a la fois vrai et
     rassurant — c'est le mot que la page emploie deja sur ses tuiles d'indices
     et dans sa carte du jour. L'age reste dans l'infobulle pour qui le cherche.

     `dayPerformance().toutHorsSeance` plutot qu'un calcul d'horaires : les places
     n'ouvrent pas aux memes heures, et un ETF europeen dans un portefeuille
     americain ferait mentir n'importe quelle table. Ce qui compte n'est pas
     l'heure qu'il est, c'est qu'aucune ligne detenue n'ait bouge. */
  const j = dayPerformance();
  const ferme = !!j.toutHorsSeance;
  const partiel = !ferme && j.horsSeance > 0;
  if (partiel) { btn.classList.remove('frais'); btn.classList.add('tiede'); }
  quand.textContent = ferme ? trad('hors séance')
                    : partiel ? `${j.horsSeance} ${trad('hors séance')}`
                    : marche ? fmtWhen(new Date(marche * 1000))
                    : last ? fmtWhen(last) : trad('Cours');
  btn.title = marche
    ? `${trad('Cours')} ${fmtCoursQuand(marche)}, ${trad('relevés')} ${fmtWhen(last)}`
      + (ferme ? ` · ${trad('aucune de tes lignes n’a coté depuis minuit')}`
       : partiel ? ' · ' + trad(j.horsSeance > 1
                    ? '{n} lignes sur {t} n’ont pas encore coté aujourd’hui'
                    : '{n} ligne sur {t} n’a pas encore coté aujourd’hui')
                    .replace('{n}', j.horsSeance).replace('{t}', j.lignes.length)
       : '')
      + ` · ${trad('cliquer pour actualiser')}`
    : last
    ? `${trad('Cours mis à jour')} ${fmtWhen(last)} · ${trad('cliquer pour actualiser')}`
    : trad('Récupérer les cours de bourse');
}

function symbolSearchCard() {
  const on = Quotes.isOnline();
  return `
    <div class="card">
      <div class="card-head"><h2>${trad('Ajouter une ligne')}</h2></div>
      <p class="small muted" style="margin:0 0 12px">
        ${trad('Pas d’ISIN, ou un titre coté nulle part ?')}
        <button class="lien-nu" data-action="add-position">${trad('Saisir la ligne à la main')}</button>
      </p>
      <div class="barre-recherche" style="margin-top:12px">
        <input id="symQuery" placeholder="${trad('ISIN ou nom, ex. IE000OJ5TQP4')}" style="text-align:left">
        <button class="btn sm" id="symSearch" ${on === false ? 'disabled' : ''}>${trad('Chercher')}</button>
        <select class="menu-serre" data-path="meta.preferredExchange"
                title="${trad('Place privilégiée quand un ISIN est coté sur plusieurs marchés')}">
          ${(() => {
            const choisi = Store.state.meta.preferredExchange ?? '.PA';
            return EXCHANGES.map(([region, places]) => `<optgroup label="${esc(region)}">${
              places.map(([v, l]) =>
                `<option value="${v}" ${v === choisi ? 'selected' : ''}>${esc(l)}</option>`).join('')
            }</optgroup>`).join('');
          })()}
        </select>
      </div>
      <p class="small muted" style="margin:8px 0 0">
        <b>${trad('Colle plutôt l\'ISIN de ton relevé')}</b>${trad(' : la ligne se remplit alors entièrement.')}${aide(trad("Une recherche par nom donne le nom, le symbole, la devise et le cours, mais pas l’ISIN : aucune source gratuite ne le retrouve à partir d’un symbole. Partir de l’ISIN est le seul chemin qui remplit tout."))}
      </p>
      <div id="symResults" class="small" style="margin-top:12px"></div>
    </div>`;
}

/* La devise et le taux d'un titre, resolus AVANT toute ecriture. `cote` est
   la cotation lue a l'ouverture de la fenetre, quand elle a repondu. Sans
   devise connue, on la demande ; pour une devise etrangere, on demande
   ensuite la paire de change. Rend `null` si l'un des deux manque : on ne
   cree jamais une ligne etrangere au repli euro et taux 1. */
async function resoudreLigne(symbole, cote) {
  let devise = cote && cote.currency, cours = cote && cote.price, nom = cote && cote.name;
  if (!devise) {
    const q = await coteDuSymbole(symbole);
    if (!q || !q.currency) return null;
    devise = q.currency; cours = q.price; nom = q.name;
  }
  const base = deviseBase();
  if (devise === base) return { devise, fx: 1, cours: num(cours), nom };
  try {
    const r = await fetch(`${Quotes.BASE}/api/quotes?symbols=${encodeURIComponent(`${base}${devise}=X`)}`,
                          { cache: 'no-store' });
    const q = (await r.json()).quotes?.[0];
    const fx = q && !q.error && q.price ? 1 / q.price : null;
    return fx && nombreValide(fx, 'change') ? { devise, fx, cours: num(cours), nom } : null;
  } catch (e) { return null; }
}

/* Le cours et la devise d'un symbole, ou `null`.
   Rend `null` a la moindre difficulte — passerelle endormie, symbole sans
   cotation, reponse illisible — parce que l'appelant s'en sert pour meubler
   une question, jamais pour calculer : un repere absent laisse la fenetre
   s'ouvrir, une exception l'empecherait. */
async function coteDuSymbole(symbole) {
  const sym = String(symbole || '').trim().toUpperCase();
  if (!sym) return null;
  if (Quotes.isOnline() === null) await Quotes.health();
  if (Quotes.isOnline() === false) return null;
  try {
    const r = await fetch(`${Quotes.BASE}/api/quotes?symbols=${encodeURIComponent(sym)}`,
                          { cache: 'no-store' });
    const q = (await r.json()).quotes?.[0];
    return q && !q.error && num(q.price) ? q : null;
  } catch {
    return null;
  }
}

function mountSymbolSearch() {
  const btn = $('#symSearch'), input = $('#symQuery'), out = $('#symResults');
  if (!btn) return;

  const looksLikeIsin = s => /^[A-Za-z]{2}[A-Za-z0-9]{9}[0-9]$/.test(s.replace(/\s/g, ''));

  async function run() {
    const q = input.value.trim();
    if (q.length < 2) {
      out.innerHTML = `<p class="muted">${trad('Tape au moins deux caractères.')}</p>`;
      return;
    }

    const asIsin = looksLikeIsin(q) ? q.replace(/\s/g, '').toUpperCase() : null;
    if (asIsin && !isinIsValid(asIsin)) {
      out.innerHTML = `<p class="down">⚠ <b>${esc(asIsin)}</b> ${trad('a le bon format '
        + 'mais une clé de contrôle incorrecte : il y a probablement une faute de frappe.')}</p>`;
      return;
    }

    out.innerHTML = `<p class="muted">${trad('Recherche…')}</p>`;
    try {
      let res, isinCode = null, bestSymbol = null;
      if (asIsin) {
        const r = await Quotes.resolveIsin(asIsin);
        if (r.error && !(r.candidates || []).length) { out.innerHTML = `<p class="down">⚠ ${esc(r.error)}</p>`; return; }
        res = r.candidates || [];
        isinCode = asIsin;
        bestSymbol = r.best && r.best.symbol;
      } else {
        res = await Quotes.search(q);
      }
      if (!res.length) {
        out.innerHTML = `<p class="muted">${trad('Aucun résultat.')}</p>`;
        return;
      }

      out.innerHTML = `
        ${isinCode ? `<p class="small muted" style="margin:0 0 8px">${trad(res.length > 1
           ? 'ISIN valide · {n} cotations trouvées, la première correspond à ta place privilégiée.'
           : 'ISIN valide · {n} cotation trouvée, la première correspond à ta place privilégiée.')
           .replace('{n}', res.length)}</p>` : ''}
        <table class="table-serree cols-nom-action"><tbody>${res.map(r => `
        <tr>
          <td class="name">${esc(r.symbol)}${r.symbol === bestSymbol ? ` <span class="tag">${trad('retenu')}</span>` : ''}
              <span class="sub">${esc(r.name)}${[r.exchange, r.type].filter(Boolean).length
                ? ` · ${esc([r.exchange, r.type].filter(Boolean).join(' · '))}` : ''}</span></td>
          <td><button class="btn sm assign-target" data-symbol="${esc(r.symbol)}"
                      data-nom="${esc(r.name || '')}" data-isin="${esc(isinCode || '')}"
                      data-type="${esc(r.type || '')}"
                      title="${trad('Créer une ligne de titres pour ce résultat')}">+ ${trad('Ajouter')}</button></td>
        </tr>`).join('')}</tbody></table>`;

      out.querySelectorAll('.assign-target').forEach(bouton => {
        bouton.addEventListener('click', async () => {
          bouton.disabled = true;
          const cote = await coteDuSymbole(bouton.dataset.symbol);
          bouton.disabled = false;

          const cat = classeDuType(bouton.dataset.type);
          const deduite = !!bouton.dataset.type;
          const depart = compteDeDepart(cat, compteVisePourAjout);
          const classeCourante = () => {
            const e = $('#f_assetClass');
            return e && e.tagName === 'SELECT' ? e.value : cat;
          };
          const v = await askForm({
            titre: bouton.dataset.nom || bouton.dataset.symbol,
            sous: trad('Où ranger cette ligne ?'),
            ok: 'Créer la ligne',
            valide: x => x.debiter && num(x.qty) * num(x.buyPrice) > 0 && x.partie === PART_A_CHOISIR
              ? { cle: 'partie', message: trad('Choisis la part qui paie.') } : null,
            lie: [
              ...(deduite ? [] : [{ de: 'assetClass', vers: 'account', options: comptesPourListe,
                                    prefere: c => compteDeDepart(c),
                                    vide: 'aucun compte ne peut porter cette classe' }]),
              ...liensCompteParDefaut(classeCourante, !deduite),
              { de: 'account', vers: 'debiter', coche: id => !contratSansCash(id), aide: aideDebitAjout },
              { de: 'account', vers: 'partie', options: id => listeDeParts(comptesQuiPaient(id), id).options,
                vide: trad('ce compte ne porte pas d’espèces') },
            ],
            champs: [
              { cle: 'account', label: 'Compte', type: 'liste', options: comptesPourListe(cat),
                valeur: depart, aide: trad('limité aux comptes compatibles') },
              champCompteParDefaut(cat, depart),
              { cle: 'qty', label: 'Quantité', type: 'nombre', exemple: '0',
                aide: trad('laisse zéro si tu n’as pas encore acheté') },
              { cle: 'buyPrice', type: 'nombre',
                requis: v => num(v.qty) > 0,
                valeur: cote ? cote.price : '',
                label: cote && cote.currency
                  ? `${trad('Prix de revient unitaire')} (${cote.currency})`
                  : trad('Prix de revient unitaire'),
                exemple: cote ? String(cote.price) : '0',
                aide: cote
                  ? `${trad('pré-rempli au cours du jour')} · ${
                      trad('ce que tu as payé peut être différent')}`
                  : trad('le prix payé par titre, dans la devise du titre') },
              { cle: 'coutTotal', label: trad('Total'),
                aide: cote && cote.currency && cote.currency !== deviseBase()
                  ? trad('le débit se convertit au taux du jour') : '',
                calcul: v => num(v.qty) > 0 && num(v.buyPrice) > 0
                  ? fmtCur(num(v.qty) * num(v.buyPrice), (cote && cote.currency) || deviseBase())
                  : '…' },
              ...(cashTargets().length ? [{
                cle: 'debiter', type: 'case', valeur: !contratSansCash(depart),
                label: trad('Débiter le paiement d’une part d’espèces'),
                aide: aideDebitAjout(depart) },
              { cle: 'partie', label: trad('Payé depuis'), type: 'liste',
                ...(({ options, valeur }) => ({ options, valeur }))(listeDeParts(
                  comptesQuiPaient(depart), depart)),
                montreSi: x => x.debiter }] : []),
              deduite
                ? { cle: 'assetClass', label: trad('Classe d’actif'), lecture: true,
                    valeur: ASSET_CLASSES[cat] || cat,
                    aide: `${trad('déduite de')} ${guill(bouton.dataset.type)}${
                      trad(', modifiable sur la fiche de la ligne')}` }
                : { cle: 'assetClass', label: trad('Classe d’actif'), type: 'liste',
                    options: OPTIONS_CLASSE, valeur: cat },
              { cle: 'role', label: 'Rôle', type: 'liste', options: OPTIONS_ROLE,
                valeur: 'satellite', aide: trad('coeur de portefeuille ou pari satellite') },
              { cle: 'dateAchat', label: trad('Date d’achat'), type: 'date', valeur: todayISO(),
                aide: DATE_ACHAT_AIDE },
            ],
          });
          if (!v) return;
          if (!v.account) { toast(trad('Ouvre d’abord un compte qui accepte cette catégorie')); return; }
          compteVisePourAjout = null;      // la visee ne vaut que pour ce geste
          const brouillon = await resoudreLigne(bouton.dataset.symbol, cote);
          const ligne = {
            id: 'p' + Date.now(), name: bouton.dataset.nom || (brouillon && brouillon.nom) || bouton.dataset.symbol,
            isin: bouton.dataset.isin || '', symbol: bouton.dataset.symbol,
            qty: v.qty, buyPrice: v.buyPrice,
            /* Un champ en lecture ne rend aucune valeur : la classe deduite
               vient de `cat`, jamais de la reponse. */
            assetClass: deduite ? cat : v.assetClass, role: v.role, account: v.account, manual: false,
            dateAchat: v.dateAchat || '',
          };
          const achete = num(v.qty) * num(v.buyPrice) > 0;
          let debit = v.debiter && achete ? lirePart(v.partie) : null;
          const r = verifierAjout({ qty: ligne.qty, buyPrice: ligne.buyPrice, brouillon, debit });
          if (r.erreur && !r.debit) { toast(r.erreur); return; }
          if (v.debiter && achete && (!debit || r.erreur)) {
            const garder = await askConfirm(`${r.erreur || trad('Aucune part d’espèces de ce compte ne peut payer cet achat.')}\n\n`
              + trad('Garder la ligne sans toucher aux espèces ?'), { ok: 'Garder sans débit' });
            if (!garder) return;        // rien n'a ete ecrit
            debit = null;
          }
          const a = creerLigneAchetee({ ligne, brouillon, debit });
          if (a.erreur) { toast(a.erreur); return; }
          poserCompteParDefaut(ligne.assetClass, v.account, !!v[CLE_CASE_DEFAUT]);
          Store.save(); render();
          toast(a.debite ? `${ligne.name} ${trad('ajouté')} · ${fmtEUR0(a.coutBase)} ${trad('débité')}` : `${ligne.name} ${trad('ajouté')}`);
          Quotes.refresh().then(() => render()).catch(() => {});
        });
      });
    } catch (e) {
      out.innerHTML = `<p class="down">${esc(e.message)}</p>`;
    }
  }

  btn.addEventListener('click', run);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
}

/* `financier` : sans les murs ni les objets. La regle et les deux listes de
   poches exclues vivent dans `store.js`, une seule fois. */
function pochesPatrimoine({ financier = false, net = false } = {}) {
  const attente = num(patrimoine().investir);
  const habits = new Map(SERIES_PATRIMOINE().map(s => [s.key, s]));
  return poidsPoches({ financier, net }).map(p => {
    const s = p.key === DETTES_NON_AFFECTEES
      ? { label: trad('Dettes non affectées'), color: 'var(--muted)' }
      : habits.get(p.key) || {};
    return { key: p.key, label: s.label, color: s.color, value: p.value, pct: p.pct,
             note: p.key === 'cash' && attente > 0.005
               ? `${trad('dont')} ${fmtEUR0(attente)} ${trad('à investir')}`
               : p.key !== DETTES_NON_AFFECTEES && num(p.dettes) > 0.005
                 ? trad('après {v} de crédit').replace('{v}', fmtEUR0(p.dettes)) : '' };
  });
}

const nomPortefeuille = () => trad('Comptes de marché');

const teinterParRang = items =>
  items.map((x, i) => ({ ...x, couleur: x.couleur || x.color || `var(--series-${(i % 8) + 1})` }));

const COULEUR_RESTE_PORTEFEUILLE = 'var(--muted)';
const couleurTranche = x => (x.tranche == null
  ? COULEUR_RESTE_PORTEFEUILLE : `var(--series-${(x.tranche % 8) + 1})`);

let pfAutresOuvert = false;
let pfToutesOuvert = false;

function tableauPortefeuille(pf) {
  const t = pf.tableau;
  const pourcent = x => (x.pct == null ? '' : fmtPct(x.pct));
  const cellules = x => `<td class="montant">${fmtEUR(x.value)}</td>
        <td class="muted pct">${pourcent(x)}</td>`;
  const rangee = (x, cls) => `
      <tr${cls ? ` class="${cls}"` : ''}><td class="name">${pastilleTeinte(couleurTranche(x))}${esc(x.label)}</td>
        ${cellules(x)}</tr>`;
  const tete = t.lignes.filter(x => !x.replie);
  const replies = t.lignes.filter(x => x.replie);
  const classes = ['table-portefeuille', pfAutresOuvert ? 'autres-ouvert' : '',
                   pfToutesOuvert ? 'tout-voir' : ''].filter(Boolean).join(' ');
  return `
    <table class="${classes}">
      <thead><tr><th>${trad('Ligne')}</th><th>${trad('Montant')}</th><th>%</th></tr></thead>
      <tbody>${tete.map(x => rangee(x)).join('')}${replies.map(x => rangee(x, 'pf-replie')).join('')}${t.repliees ? `
      <tr class="pf-plus"><td class="name">
          <button type="button" class="btn sm ghost" data-action="pf-toutes" aria-expanded="${pfToutesOuvert}">
            <span class="pf-voir-tout">${trad('Voir toutes les lignes')}</span><span class="pf-voir-moins">${trad('Voir moins')}</span></button>
          <span class="sub pf-somme">${trad('{n} lignes de plus').replace('{n}', t.repliees.nb)}</span></td>
        <td class="montant"><span class="pf-somme">${fmtEUR(t.repliees.value)}</span></td>
        <td class="muted pct"><span class="pf-somme">${pourcent(t.repliees)}</span></td></tr>` : ''}${t.autres ? `
      <tr class="pf-autres"><td class="name">
          <button type="button" class="pf-bascule" data-action="pf-autres" aria-expanded="${pfAutresOuvert}">${
            pastilleTeinte(COULEUR_RESTE_PORTEFEUILLE)}<span class="pf-bascule-texte">${esc(t.autres.label)}<span class="pf-chev" aria-hidden="true">⌄</span><span class="sub">${
            trad('{n} lignes de moins de {s}').replace('{n}', t.autres.lignes.length)
              .replace('{s}', fmtPct(SEUIL_LIGNE_PORTEFEUILLE_PCT, 0).replace(' ', '\u00a0'))}</span></span></button></td>
        ${cellules(t.autres)}</tr>${t.autres.lignes.map(x => `
      <tr class="pf-sous"><td class="name">${esc(x.label)}</td>
        ${cellules(x)}</tr>`).join('')}` : ''}${t.cash ? rangee(t.cash) : ''}</tbody>
      <tfoot><tr><td>${esc(nomPortefeuille())}</td><td class="montant">${fmtEUR(pf.total)}</td><td></td></tr></tfoot>
    </table>`;
}

/* Ce que le classement par poids montre sans le dire : une ligne pese un tiers
   de tout, et il fallait lire l'axe pour s'en apercevoir.

   La phrase se pose sous les barres, la ou le classement se lit, et pas en tete
   de carte : c'est une lecture du graphique, pas un chiffre de plus.

   En `hint` gris, jamais en couleur et jamais en rouge. Le rouge dit ce qui est
   faux, et une concentration ne l'est pas — elle depend d'un projet que
   l'application ne connait pas. `concentration()` se tait deja quand il n'y a
   rien a dire ; ici on ne fait que rendre. */
function phraseConcentration() {
  const c = concentration({ financier: allocFinancier });
  if (!c) return '';
  const base = baseAvoirsAlloc().de;
  const tete = `<b>${esc(c.premiere.label)}</b> ${trad('pèse')} `
    + `${fmtPct(c.premiere.pct, 1)} ${base}`;
  const trois = c.top3
    ? ` · ${trad('tes trois premières expositions')} ${fmtPct(c.top3.pct, 1)}` : '';
  return `<p class="hint" style="margin:8px 0 0">${tete}${trois}</p>`;
}

const RAPPROCHEMENTS_VISIBLES = 3;
const lieuParticipation = p => [nomEtabDe(p.compte),
  `${trad('compte')} ${guill(nomCompteV2(p.compte))}`].filter(Boolean).join(' · ');
const nomEntite = e => (e.societe ? e.societe.nom : e.participations[0]?.libelle || '');
const nombreParticipations = n => `${n} ${trad(n > 1 ? 'participations' : 'participation')}`;
function blocSocietes() {
  const groupes = groupesSocietes({ financier: allocFinancier });
  const suggestions = suggestionsRapprochement();
  if (!groupes.length && !suggestions.length) return '';
  const base = valeurAvoirsAlloc();
  const de = baseAvoirsAlloc().de;
  const lignes = groupes.map(g => ligneListe({
    action: 'societe-detail', index: esc(g.id), titre: g.nom,
    sous: [nombreParticipations(g.participations.length),
           g.credits.length ? trad('avec crédit') : ''].filter(Boolean).join(' · '),
    valeur: fmtEUR(g.valeur),
    second: base > 0.005 ? `${fmtPct(g.valeur / base * 100, 1)} ${de}` : '',
  })).join('');
  const detailEntite = e => (e.societe
    ? `${esc(e.societe.nom)} ${trad('regroupe déjà')} ${nombreParticipations(e.participations.length)}`
    : esc(lieuParticipation(e.participations[0])));
  const avis = suggestions.slice(0, RAPPROCHEMENTS_VISIBLES).map(({ a, b }) => {
    const [x, y] = !a.societe && b.societe ? [b, a] : [a, b];
    const phrase = x.societe && !y.societe
      ? trad('{l} semble appartenir à {s}.')
          .replace('{l}', `<b>${esc(nomEntite(y))}</b>`).replace('{s}', `<b>${esc(nomEntite(x))}</b>`)
      : trad('{a} et {b} semblent être la même société.')
          .replace('{a}', `<b>${esc(nomEntite(x))}</b>`).replace('{b}', `<b>${esc(nomEntite(y))}</b>`);
    const details = [detailEntite(x), detailEntite(y)].filter(Boolean).join(' · ');
    return `
      <div class="alerte-ligne controle-info">
        <span class="controle-ic" aria-hidden="true">≈</span>
        <div class="controle-texte"><span>${phrase}</span><span class="sub">${details}</span></div>
        <span class="alerte-actes">
          <button type="button" class="btn sm" data-action="societe-rapprocher"
                  data-a="${esc(x.cle)}" data-b="${esc(y.cle)}">${trad('Même société')}</button>
          <button type="button" class="btn sm ghost" data-action="societe-ecarter"
                  data-a="${esc(x.cle)}" data-b="${esc(y.cle)}">${trad('Deux sociétés')}</button>
        </span>
      </div>`;
  }).join('');
  const reste = suggestions.length - RAPPROCHEMENTS_VISIBLES;
  return `
    <h3 class="sous-titre-carte">${trad('Sociétés sous-jacentes')}${aide(trad('Tes participations dans une même société se somment ici : deux levées dans la même société font une seule exposition. Chacune garde sa fiche, ses opérations et sa valeur. Un crédit ne réduit jamais l’exposition, il se lit dans le détail.'))}</h3>
    ${lignes ? `<div class="liste-principale societes">${lignes}</div>` : ''}
    ${avis ? `<div class="alertes rapprochements">${avis}</div>
      <p class="hint">${trad('Un nom voisin ne suffit pas : rien ne se regroupe sans ta réponse.')}${
        reste > 0 ? ` ${trad('{n} autres rapprochements suivront.').replace('{n}', reste)}` : ''}</p>` : ''}`;
}

const ANGLES_ALLOCATION = [['categorie', 'Catégorie'], ['lignes', 'Lignes de marché'],
                           ['detention', 'Détention'], ['disponibilite', 'Disponibilité']];
const ANCRES_ANGLES = { actifs: 'categorie', 'lignes-marche': 'lignes',
                        detention: 'detention', disponibilite: 'disponibilite' };
let allocAngle = 'categorie';
let allocAngleNav = -1;
function viewAllocation() {
  const t = nowTotals();
  if (!(patrimoine().brut > 0.005)) {
    return pageAvantDonnees('Une répartition dit où est ton argent : dans quelles classes '
      + 'd’actifs, chez quels intermédiaires. Elle attend donc que tu déclares au moins un '
      + 'compte ou un placement.');
  }
  const poches = pochesPatrimoine({ financier: allocFinancier, net: true });
  const byAsset = allocationByAsset({ credits: false, financier: allocFinancier });
  const byAcct = allocationByAccount({ financier: allocFinancier });
  const byType = teinterParRang(byAccountType({ financier: allocFinancier }));
  const dispo = teinterParRang(allocationParDisponibilite({ financier: allocFinancier }));
  if (allocAngleNav !== navsInternes) { allocAngleNav = navsInternes; allocAngle = 'categorie'; }
  if (pendingAnchor && ANCRES_ANGLES[pendingAnchor]) allocAngle = ANCRES_ANGLES[pendingAnchor];
  const angles = ANGLES_ALLOCATION.filter(([k]) => k !== 'lignes' || repartitionPortefeuille());
  if (!angles.some(([k]) => k === allocAngle)) allocAngle = 'categorie';
  /* L'angle qu'on vient de choisir entre dans sa section : voir `allocAngleEntre`. */
  const entreeAngle = allocAngleEntre ? ' angle-entre graphes-poussent' : '';

  /* A l'euro, parts et pied : les parts arrondies refont le total arrondi, voir
     `arrondirParts`. Le tableau des lignes de marche garde ses centimes : il
     montre des positions, qu'on rapproche d'un releve de courtier. */
  const tbl = (items, totalLabel, total, entete = trad('Ligne')) => (() => {
    const arrondis = arrondirParts(items.map(i => i.value), total);
    return `
    <table>
      <thead><tr><th>${entete}</th><th>${trad('Montant')}</th><th>%</th></tr></thead>
      <tbody>${items.map((i, k) => `<tr><td class="name">${pastilleTeinte(i.couleur || i.color)}${esc(i.label)}
        ${i.note ? `<span class="sub">${escMontant(i.note)}</span>` : ''}</td>
        <td class="montant">${fmtEUR0(arrondis[k])}</td>
        <td class="muted pct">${i.pct == null ? '' : fmtPct(i.pct, 1)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td>${esc(totalLabel)}</td><td class="montant">${fmtEUR0(total)}</td><td></td></tr></tfoot>
    </table>`;
  })();

  /* Trois teintes franchement distinctes, et pas voisines dans la palette :
     `series-7` (#00a5c3) et `series-2` (#00ab92) sont deux cyans que rien ne
     sépare sur une pastille de 8 px. L'ambre est déjà, dans l'application, la
     couleur de ce qui attend une action — c'est le point du menu quand un
     relevé manque. Il dit ici la même chose d'un argent qui ne travaille pas
     encore. */
  const teintesPoche = { courant: 'var(--series-1)', precaution: 'var(--series-7)',
                         projet: 'var(--series-5)', investir: 'var(--series-4)' };
  const disponibilite = [
    /* Le nom suit le perimetre, parce que la poche n'est pas la meme chose des
       deux cotes. En vue financiere elle ne contient que du placement, et
       « Investi » la nomme juste. En vue globale elle porte aussi les murs, la
       montre et la voiture : les appeler « investi » ferait passer un logement
       pour un placement, ce qu'il n'est pas pour qui l'habite.

       `BASES.place.nom` ne bouge pas pour autant : deux autres fiches le lisent,
       et il y designe bien de l'investi. C'est ce libelle-ci, et lui seul, qui
       depend du perimetre affiche. */
    { label: allocFinancier ? BASES.place.nom : trad('Placements et biens'),
      value: allocFinancier ? t.invested - horsFinancierTotal()
                            : t.invested - num(t.dettes),
      couleur: 'var(--series-2)' },
    ...pochesLiquidites().map(p => ({
      label: p.nom, value: p.value, couleur: teintesPoche[p.cle] || 'var(--series-1)',
    })),
    /* `t.invested` laisse dehors toute la classe liquidites, supports
       monetaires compris : ils reviennent ici sous leur nom, sinon la carte
       ne refait plus sa base. */
    { label: LIBELLE_LIQUIDITES_EN_LIGNES, value: liquiditesEnLignes(),
      couleur: 'var(--series-6)' },
  ].filter(x => Math.abs(num(x.value)) > 0.005)
   /* `null` et non zero quand la base ne se divise pas : un patrimoine net
      negatif retournerait tous les signes, et « 0,0 % » sous chaque ligne se
      lirait comme une mesure alors que c'est une absence de mesure. */
   .map(x => ({ ...x, pct: partsAllocLisibles()
                  ? num(x.value) / valeurBaseAlloc() * 100 : null }));
  /* Les montants de la carte a l'euro, qui refont son pied : voir `arrondirParts`. */
  const dispoArrondie = arrondirParts(disponibilite.map(x => x.value), valeurBaseAlloc());

  return `
  ${horsFinancierExiste() ? barreCommutateur([
    ['financier', 'Financier'], ['tout', 'Tout'],
  ], allocFinancier ? 'financier' : 'tout', 'alloc-base', 'base') : ''}

  <p class="perimetre perimetre-tete">${trad('Ici,')} <b>${allocFinancier
      ? (horsFinancierExiste()
          ? trad('immobilier en direct et biens de valeur écartés, avec leurs crédits')
          : trad('tes avoirs'))
      : trad('tes crédits sont déduits')}</b>${deuxPoints()}
    ${fmtEUR0(valeurBaseAlloc())}, <span class="sans-veuve">${trad('non coté compris')}${aide(allocFinancier && !horsFinancierExiste()
      ? trad("Rien n’est écarté ici : tu n’as ni bien immobilier détenu en direct, ni bien de valeur. Le non coté reste, lui aussi. Les répartitions ci-dessous portent toutes sur ces avoirs : une dette ne se répartit pas entre tes comptes ni entre tes classes d’actifs.")
      : allocFinancier
      ? trad("Les biens immobiliers détenus en direct et les biens de valeur sont écartés, et les crédits qui leur sont explicitement rattachés le sont avec eux. La pierre papier reste : une SCPI, ou le support immobilier d’une assurance-vie, s’arbitre comme un fonds. C’est un placement, pas un mur. Les autres dettes, une marge ou un prêt personnel, se déduisent du patrimoine financier net, annoncé en tête dès qu’il en existe une. Le non coté reste : on choisit d’y remettre ou non, alors qu’on ne vend pas trois mètres carrés de salon. Les répartitions ci-dessous portent toutes sur tes avoirs financiers : une dette ne se répartit pas entre tes comptes ni entre tes classes d’actifs.")
      : trad("Deux bases sur cette page, et chaque carte annonce la sienne. « Patrimoine net » pour la répartition : tout ce que tu possèdes moins ce que tu dois encore, chaque classe financée par un crédit qui lui est rattaché y comptant pour sa valeur moins ce crédit, et les crédits sans destination connue sur leur propre ligne, « Dettes non affectées ». « Tes avoirs » pour les cartes qui disent où ton argent est posé et en combien de temps il ressort : une dette n’est posée sur aucun compte et n’a pas de délai de sortie, elle ne s’y retranche donc pas. Chaque total redonne la base annoncée juste au-dessus de lui."))}.</span></p>

  ${allocFinancier && dettesFinancieresTotal() > 0.005 ? `
  <dl class="kv perimetre-net">
    <dt>${BASES.avoirsFinanciers.nom}</dt><dd>${fmtEUR0(totalFinancier())}</dd>
    <dt>${trad('Dettes hors biens immobiliers directs')}${aide(trad(
      'Un crédit explicitement rattaché à un logement détenu en direct est écarté avec lui. Toutes les autres dettes restent ici : une marge de courtier, un prêt personnel, un crédit dont le bien n’est pas renseigné.'))}</dt>
      <dd>${montantSigne(-dettesFinancieresTotal())}</dd>
    <dt><b>${BASES.netFinancier.nom}</b></dt>
      <dd><b>${fmtEUR0(netFinancier())}</b></dd>
  </dl>` : ''}

  <div class="card repart">
    ${disponibilite.map((x, i) => `
      <div class="repart-ligne repart-inerte">
        <span class="repart-haut">
          <span class="dot" style="background:${x.couleur}"></span>
          <span class="repart-nom">${esc(trad(x.label))}</span>
          <b>${fmtEUR0(dispoArrondie[i])}</b>
          <span class="repart-pct">${x.pct == null ? '' : fmtPct(x.pct, 1)}</span>
        </span>
        <span class="repart-barre"><i style="width:${x.pct == null ? 0 : Math.max(0, Math.min(100, x.pct)).toFixed(1)}%;background:${x.couleur}"></i></span>
      </div>`).join('')}
    <dl class="kv repart-pied">
      <dt>${baseAlloc().nom}<span class="sub">${
        !allocFinancier && num(t.dettes) > 0.005
          ? `${fmtEUR0(t.dettes)} ${trad('de dettes déjà déduites')}`
          : trad('la base des pourcentages ci-dessus')}</span></dt>
        <dd>${fmtEUR0(valeurBaseAlloc())}</dd>
    </dl>
  </div>

  <div class="card alloc-repartition" data-anchor="repartition">
    <div class="card-head"><h2>${trad('Répartition.carte', 'Répartition')}</h2></div>
    <div class="segmented seg-mini alloc-angles" role="group" aria-label="${esc(trad('Angle de la répartition'))}">
      ${angles.map(([k, l]) => `<button type="button" data-action="alloc-angle" data-angle="${k}"
        class="${k === allocAngle ? 'on' : ''}" aria-pressed="${k === allocAngle}">${trad(l)}</button>`).join('')}
    </div>
  ${allocAngle !== 'categorie' ? '' : `
  <section class="alloc-angle${entreeAngle}" data-anchor="actifs">
    <p class="tete-legende">${mentionBase(baseAlloc(), valeurBaseAlloc())}</p>
    <div class="anneau-tableau">
      <div class="anneau-col"><div class="chart" id="aMacro"></div></div>
      ${tbl(poches, baseAlloc().nom,
             valeurBaseAlloc())}
    </div>
    <h3 class="sous-titre-carte">${trad('Par catégorie d’actif')}</h3>
    <p class="tete-legende">${mentionBase(baseAvoirsAlloc(), valeurAvoirsAlloc())}</p>
    <div class="chart" id="aAsset"></div>
    ${phraseConcentration()}
    ${blocSocietes()}
  </section>

  `}
  ${allocAngle !== 'lignes' ? '' : (() => {
    const pf = repartitionPortefeuille();
    if (!pf) return '';
    const ra = pf.resteAnneau;
    const resteElargi = ra && ra.nb !== (pf.tableau.autres ? pf.tableau.autres.lignes.length : 0);
    return `
  <section class="alloc-angle${entreeAngle}" data-anchor="lignes-marche">
    <p class="tete-legende">${mentionBase({ de: trad('de tes comptes de marché') }, pf.total)}${aide(trad('La part de chaque ligne. Tes comptes de marché portent tes titres cotés, leurs placements sans cours et le cash qui y attend d’être investi.')
      + ' ' + trad('Un fonds compte pour UNE ligne : un portefeuille d’un seul ETF monde donne une part de 100 %, ce qui ne veut pas dire qu’il est concentré. Cette carte répartit des montants, elle ne lit pas ce qu’il y a dans un fonds.'))}</p>
    <div class="anneau-tableau">
      <div class="anneau-col">
    <div class="chart" id="aPortefeuille"></div>
    ${!resteElargi ? '' : `<p class="hint" style="margin:8px 0 12px">${
      trad('L’anneau résume : « {l} » réunit ce qui porte une pastille grise dans le tableau, {n} lignes pour {v}, soit {p}.')
        .replace('{l}', esc(ra.label)).replace('{n}', ra.nb)
        .replace('{v}', fmtEUR(ra.value)).replace('{p}', fmtPct(ra.pct))}</p>`}
    ${!pf.ecartees ? '' : `<p class="hint" style="margin:8px 0 0">${
      trad('{n} ligne(s) sans valeur positive ne figurent pas ici.').replace('{n}', pf.ecartees)}</p>`}
      </div>
      ${tableauPortefeuille(pf)}
    </div>
  </section>

`;
  })()}
  ${allocAngle !== 'detention' ? '' : `
  <section class="alloc-angle${entreeAngle}" data-anchor="detention">
    <p class="tete-legende">${mentionBase(baseAvoirsAlloc(), valeurAvoirsAlloc())}</p>
    <div class="anneau-tableau">
      <div class="anneau-col"><div class="chart" id="aType"></div></div>
      ${tbl(byType, baseAvoirsAlloc().nom, byType.reduce((s, i) => s + i.value, 0), trad('Type de détention'))}
    </div>
    <h3 class="sous-titre-carte">${trad('Par compte')}</h3>
    <div class="chart" id="aAcct"></div>
  </section>
  `}

  ${allocAngle !== 'disponibilite' ? '' : `
  <section class="alloc-angle${entreeAngle}" data-anchor="disponibilite">
    <p class="tete-legende">${mentionBase(baseAvoirsAlloc(), valeurAvoirsAlloc())}${aide(allocFinancier
      ? trad("Le délai vient de la classe de la ligne et du type de compte qui la porte, jamais d’une supposition sur ton projet. Tes murs et tes objets de valeur sont écartés de cette vue, et c’est ce qui fait disparaître le palier du logement que tu habites.")
      : trad("Le délai vient de la classe de la ligne et du type de compte qui la porte, jamais d’une supposition sur ton projet. Le logement que tu habites et ce qui est bloqué jusqu’à une échéance figurent ici parce qu’ils font partie de tes avoirs, mais la réserve de sécurité de l’accueil les écarte de son cumul : elle compte ce sur quoi tu peux vivre, pas ce que tu possèdes."))}</p>
    <div class="anneau-tableau">
      <div class="anneau-col"><div class="chart" id="aDispo"></div></div>
      ${tbl(dispo, baseAvoirsAlloc().nom, dispo.reduce((s, i) => s + i.value, 0))}
    </div>
  </section>
  `}
  </div>
  ${carteInsights('allocation', 'À retenir')}

`;
}

function mountAllocation() {
  Charts.rankedBars($('#aAsset'),
    { items: allocationByAsset({ credits: false, financier: allocFinancier, parSociete: true }) });
  Charts.rankedBars($('#aAcct'), { items: allocationByAccount({ financier: allocFinancier }) });
  const t = nowTotals();
  const animAlloc = allocTransition;
  Charts.donut($('#aMacro'), {
    anime: animAlloc,
    height: 200, centerLabel: baseAlloc().nom, centerValue: valeurBaseAlloc(),
    items: pochesPatrimoine({ financier: allocFinancier, net: true }).map(p => ({ label: p.label, value: p.value, color: p.color })),
  });
  /* L'anneau du portefeuille : ses tranches et les pastilles du tableau passent
     par la meme `couleurTranche`, donc elles ne peuvent pas diverger. Il ne se
     monte que si la carte s'est rendue — `mount` sort en silence sur un
     conteneur absent, mais le dire ici evite de compter deux fois la
     repartition. */
  const pf = repartitionPortefeuille();
  if (pf) {
    Charts.donut($('#aPortefeuille'), {
      anime: animAlloc, height: 200,
      centerLabel: nomPortefeuille(), centerValue: pf.total,
      items: pf.anneau.map(p => ({ label: p.label, value: p.value, color: couleurTranche(p) })),
    });
  }
  const bt = teinterParRang(byAccountType({ financier: allocFinancier }));
  Charts.donut($('#aType'), {
    anime: animAlloc,
    height: 200, centerLabel: baseAvoirsAlloc().nom,
    centerValue: bt.reduce((s, i) => s + i.value, 0),
    items: bt.map(x => ({ label: x.label, value: x.value, color: x.couleur })),
  });
  const bd = teinterParRang(allocationParDisponibilite({ financier: allocFinancier }));
  Charts.donut($('#aDispo'), {
    anime: animAlloc,
    height: 200, centerLabel: baseAvoirsAlloc().nom,
    centerValue: bd.reduce((s, i) => s + i.value, 0),
    items: bd.map(x => ({ label: x.label, value: x.value, color: x.couleur })),
  });
  allocTransition = false;
}

function diagnosticRoles(rr) {
  if (!rr.base) return '';
  const socle = rr.roles.find(x => x.cle === 'core');
  const sat = rr.roles.find(x => x.cle === 'satellite');
  /* La phrase nomme une classe : elle doit donc peser la classe entiere.
     `composition` est indexee par classe **et** par nature, si bien qu'« Actions
     en direct » et « Actions en fonds » y sont deux entrees ; prendre la
     premiere annoncerait « 55 % actions » quand les actions font 80 % des
     satellites : 2 400 EUR en direct sur 4 400, au lieu de 2 400 + 1 100. Le
     chiffre serait juste et son intitule mentirait. On agrege donc par classe
     avant de chercher la plus grosse. */
  const parClasse = new Map();
  for (const p of (rr.composition.satellite || [])) {
    parClasse.set(p.classe, (parClasse.get(p.classe) || 0) + p.value);
  }
  const gros = [...parClasse].sort((a, b) => b[1] - a[1])[0];
  const partGros = gros && sat.value ? gros[1] / sat.value * 100 : 0;
  if (!gros || partGros < 50) return '';
  return `<p class="plan-phrase" style="font-size:var(--font-md)"><b>${fmtPct(partGros, 0)}</b> ${
    trad('de ta part arbitrable est en')} ${esc(gros[0].toLowerCase())}.</p>`;
}

function viewRebalance() {
  const r = rebalanceRows();
  const rr = rebalanceRoles();
  const per = perimetreReequilibrage();
  const tg = Store.state.targets;
  const sumT = sommeCibles();

  if (!(r.base > 0.005)) {
    return `
  <div class="card">
    <p class="empty" style="margin:0 0 4px">${trad('Les cibles répartissent ce que tu as placé. '
      + 'Elles attendent un compte d’investissement et ce qu’il contient : PEA, compte-titres, '
      + 'assurance-vie, PER ou portefeuille de cryptomonnaies.')}</p>
    ${invitePremierPas('comptes') || `
    <button type="button" class="btn sm" data-action="ajouter-compte" data-type="cto"
            style="margin:4px 0 0">${trad('Ajouter un compte d’investissement')}</button>`}
  </div>`;
  }

  const dehorsDetail = (() => {
    const p = patrimoine();
    return [
      [trad('immobilier'), "d'immobilier", p.classes.immobilier],
      [trad('non coté'), 'de non coté', per.nonCote],
      [`${AFFECTATION_LABEL.courant.toLowerCase()} ${trad('et')} ${AFFECTATION_LABEL.precaution.toLowerCase()}`,
       `de ${AFFECTATION_LABEL.courant.toLowerCase()} et d’${AFFECTATION_LABEL.precaution.toLowerCase()}`,
       p.courant + p.precaution + p.projet],
    ].filter(([, , v]) => v > 0.005);
  })();

  /* Profondeur libre : une classe decoupee porte sa cible en
     `classes.actions.core`, soit trois niveaux. L'ancienne version en lisait
     deux et rendait zero au troisieme. */
  const valeurCible = chemin =>
    num(chemin.split('.').reduce((o, k) => (o == null ? o : o[k]), tg));

  /* `r.cash` vaut null quand la tresorerie est sortie du reequilibrage : elle
     ne figure alors ni dans les mouvements, ni dans la phrase « ta tresorerie
     disponible en couvre tant ». Trois lectures la supposaient presente, et la
     page tombait des qu'on la retirait. */
  const mouvements = r.classes.concat(r.cash ? [r.cash] : [])
    .filter(c => Math.abs(c.delta) >= 1);
  const alleger   = mouvements.filter(c => c.delta < 0).sort((x, y) => x.delta - y.delta);
  const renforcer = mouvements.filter(c => c.delta > 0).sort((x, y) => y.delta - x.delta);
  const totalVente = alleger.reduce((s, c) => s - c.delta, 0);
  const totalAchat = renforcer.reduce((s, c) => s + c.delta, 0);
  const equilibre = Math.abs(totalVente - totalAchat) < 1;
  const dispo = r.cash && r.cash.delta < 0 ? -r.cash.delta : 0;

  /* `dansLaPhrase()` est partie avec la phrase de tete de la carte : elle ne
     servait qu'a mettre un intitule de tableau au milieu d'une phrase, et il n'y
     a plus de phrase. Une fonction sans appelant est du code mort, et c'est la
     moitie qu'on oublie en retirant un affichage. */

  const listeMvt = (lignes, sens) => lignes.map(c =>
    `<li><b>${esc(c.label)}</b> <span class="montant-plan${sens > 0 ? ' renfort' : ''}">${
      sens > 0 ? '+' : '−'}${fmtEUR0(Math.abs(c.delta))}</span>
      <span class="muted">${trad('pour atteindre')} ${fmtPct(c.targetPct, 0)}</span></li>`).join('');

  const ligneReeq = (row, key, base) => {
    const part = Math.max(0, Math.min(100, row.pct));
    const cible = Math.max(0, Math.min(100, row.targetPct));
    const ecartFait = Math.abs(row.delta) < 1;
    return `
    <li class="reeq-ligne">
      <div class="reeq-haut">
        <span class="reeq-nom">${esc(row.label)}</span>
        <span class="reeq-droite">
          <b class="reeq-val">${fmtEUR(row.value)}</b>
          ${key && key.startsWith('classes.') ? `
            ${row.classeParente
              ? `<button class="chevron-role ouvert" data-action="refusionner-classe"
                         data-cle="${esc(row.classeParente)}"
                         aria-expanded="true"
                         title="${esc(trad('Refermer : une seule cible pour {c}')
                           .replace('{c}', row.labelClasse))}"
                         aria-label="${esc(trad('Refermer les deux rôles de {c}')
                           .replace('{c}', row.labelClasse))}"
                         >›</button>`
              : (() => {
                  const pr = stockTotals().parClasseRole?.[key.split('.')[1]];
                  return pr && pr.core > 0.005 && pr.satellite > 0.005
                    ? `<button class="chevron-role" data-action="decouper-classe"
                               data-cle="${esc(key.split('.')[1])}"
                               aria-expanded="false"
                               title="Ouvrir en deux cibles : ${esc(row.label)} core et satellite"
                               aria-label="${trad('Séparer {c} en core et satellite').replace('{c}', esc(row.label))}"
                               >›</button>` : '';
                })()}
            <button class="btn icon xs" data-action="retirer-classe-cible"
                    data-cle="${esc(key.split('.')[1])}"
                    title="${trad('Sortir {c} du rééquilibrage').replace('{c}', esc(row.labelClasse || row.label))}">✕</button>` : ''}
          ${key === CLE_TRESORERIE ? `
            <button class="btn icon xs" data-action="retirer-classe-cible"
                    data-cle="${esc(CLE_TRESORERIE)}"
                    title="${trad('Sortir {c} du rééquilibrage').replace('{c}', esc(row.label))}">✕</button>` : ''}
        </span>
      </div>
      ${(() => {
        const jauge = `
          <i class="reeq-reel ${row.delta > 0 ? 'sous' : row.delta < 0 ? 'sur' : 'ok'}" style="width:${part.toFixed(2)}%"></i>
          <i class="reeq-cible" style="left:${cible.toFixed(2)}%"></i>`;
        const ouvre = key === CLE_TRESORERIE
          ? { apercu: 'cashCible', arg: 'investir', quoi: 'les poches de cash' }
          : key && positionsDeCible(key)
            ? { apercu: 'cible', arg: key, quoi: 'les placements' }
            : null;
        return ouvre
          ? `<button type="button" class="reeq-jauge ouvrable" data-action="apercu"
                     data-apercu="${esc(ouvre.apercu)}" data-arg="${esc(ouvre.arg)}"
                     aria-label="Voir ${ouvre.quoi} de ${esc(row.label)}"
                     >${jauge}</button>`
          : `<div class="reeq-jauge" aria-hidden="true">${jauge}</div>`;
      })()}
      <div class="reeq-bas">
        <span class="reeq-part">${fmtPct(row.pct, 1)}
          ${key ? `<span class="muted">· ${trad('cible')}</span>
            <select class="cible-champ" data-path="targets.${key}" data-type="num"
                    aria-label="Cible pour ${esc(row.label)}">${
              paliersCible(valeurCible(key)).map(v =>
                `<option value="${v}" ${v === valeurCible(key) ? 'selected' : ''}>${v}</option>`).join('')
            }</select><span class="u">%</span>`
                : `<span class="muted">· ${trad('cible')} ${fmtPct(row.targetPct, 0)}</span>`}</span>
        <span class="reeq-ecart ${ecartFait ? 'muted' : 'a-faire'}">${ecartFait
          ? trad('à la cible')
          : `<b class="${row.delta > 0 ? 'renfort' : ''}">${
                row.delta > 0 ? '+' : '−'}${fmtEUR0(Math.abs(row.delta))}</b> ${
              row.delta > 0 ? trad('à renforcer')
              : row.cle === 'cashToInvest' ? trad('à placer') : trad('à alléger')}`}</span>
      </div>
    </li>`;
  };

  return `
  <p class="perimetre perimetre-tete">${trad('Ces cibles ne portent que sur')}
    <b>${trad('tes comptes d’investissement')}</b> ${trad('et leur trésorerie,')}
    ${fmtEUR0(r.base)}${aide(trad("PEA, compte-titres, assurance-vie, PER, portefeuille de cryptomonnaies, avec leurs lignes et l’argent qui y attend d’être placé. Ton cash du quotidien, ton épargne de précaution, ton immobilier et ton non coté n’en font pas partie : ils ne s’arbitrent pas d’un clic, et les mélanger donnerait des pourcentages qu’aucune décision ne peut suivre. Allocation, elle, montre tout ton patrimoine."))}.</p>

  <div class="card plan">
    <div class="card-head"><h2>${trad('Ce qu’il y a à faire')}${aide(trad("Les mouvements qui ramènent chaque classe à sa cible. Quand tes pourcentages totalisent 100 %, ce qu’il faut vendre finance exactement ce qu’il faut acheter."))}</h2>
      <span class="hint">${mouvements.length ? `${mouvements.length} ${mouvements.length > 1 ? trad('mouvements') : trad('mouvement')}` : sumT > 0.005 ? trad('rien à faire') : trad('cibles à fixer')}</span></div>
    ${!mouvements.length
      ? (sumT > 0.005
        ? `<p class="empty">${trad('✓ Chaque classe est à sa cible. Rien à arbitrer.')}</p>`
        : `<p class="empty">${trad('Fixe le pourcentage que tu vises par classe : '
            + 'le plan d’arbitrage s’écrira en face de ce que tu détiens.')}</p>`)
      : `
      <div class="plan-cols">
        ${alleger.length ? `<div>
          <h3>${alleger.every(c => c.cle === 'cashToInvest') ? trad('À placer') : trad('À alléger')}</h3>
          <ul>${listeMvt(alleger, -1)}</ul>
        </div>` : ''}
        ${renforcer.length ? `<div>
          <h3>${trad('À renforcer')}</h3>
          <ul>${listeMvt(renforcer, 1)}</ul>
          ${dispo && !alleger.every(c => c.cle === 'cashToInvest')
            ? `<p class="hint" style="margin:8px 0 0">${trad('Ta trésorerie disponible en couvre')} ${fmtEUR0(Math.min(dispo, totalAchat))} ${trad('sans rien vendre.')}</p>` : ''}
        </div>` : ''}
      </div>
      ${equilibre ? '' : `<p class="hint" style="margin:12px 0 0">
        ${trad('Ventes et achats ne s’équilibrent pas')} (${fmtEUR0(totalVente)} ${trad('contre')} ${fmtEUR0(totalAchat)})
        ${trad('parce que tes cibles totalisent')} ${sumT} % ${trad('et non 100 %.')}</p>`}`}
  </div>

  ${sumT === 100 ? '' : `
  <div class="note" style="background:color-mix(in oklab, var(--${sumT > 100 ? 'critical' : 'warning'}) 12%, var(--surface-1));
       border-color:color-mix(in oklab, var(--${sumT > 100 ? 'critical' : 'warning'}) 40%, transparent)">
    ${sumT > 100 ? '⚠' : 'ⓘ'}
    <span><b>${sumT > 100
      ? trad('Tes cibles totalisent {v} %, soit {x} % de trop.')
          .replace('{v}', sumT).replace('{x}', sumT - 100)
      : trad('Tes cibles totalisent {v} %, il en manque {x}.')
          .replace('{v}', sumT).replace('{x}', 100 - sumT)}</b>
    ${sumT > 100
      ? trad('Additionnés, les montants cibles demandent {v} alors que tu as {b}.')
          .replace('{v}', fmtEUR0(r.base * sumT / 100)).replace('{b}', fmtEUR0(r.base))
      : trad('Les {v} % restants ne sont attribués à aucune classe.')
          .replace('{v}', 100 - sumT)}</span>
  </div>`}

  <div class="card">
    <div class="card-head"><h2>${trad('Allocation par classe')}${aide(`${trad('L’allocation stratégique : quelle part du portefeuille dans chaque classe d’actif. C’est la première décision, celle qui pèse le plus sur le résultat. Modifie une cible dans le champ, la jauge et le plan suivent.')}

${trad('Le périmètre : tes comptes d’investissement (PEA, compte-titres, assurance-vie, PER, portefeuille crypto), avec leurs lignes et leur trésorerie à investir.')} ${
      per.montantDehors > 0
        ? `${fmtEUR0(per.montantDehors)} ${trad('restent dehors, soit')} ${dehorsDetail
             .map(([, phrase, v]) => `${fmtEUR0(v)} ${trad(phrase)}`).join(', ')}.${
           per.nonCote > 0 ? ` ${trad('Le non coté se suit en lignes de compte et non en lignes de marché : il se lit dans l’onglet')} ${SOUS_ONGLETS.allocation[0][1]}.` : ''}`
        : trad('Tout ton patrimoine y est.')}`)}</h2></div>
    <p class="tete-legende">${mentionBase(BASES.baseCibles, r.base)}</p>
    ${per.exclues.length ? `<p class="perimetre exclues">
      Sorties du rééquilibrage à ta demande :
      ${per.exclues.map(x => `<button type="button" class="mois-lien" data-action="reintegrer-classe"
          data-cle="${esc(x.cle)}" title="Remettre ${esc(x.label)} dans le rééquilibrage"
          >${esc(x.label)}${x.value ? ` (${fmtEUR0(x.value)})` : ''}</button>`).join(', ')}.
      Clique dessus pour les remettre.</p>` : ''}
    ${per.horsAtteinte.length ? `<div class="note" style="margin:0 0 12px;
         background:color-mix(in oklab, var(--warning) 12%, var(--surface-1));
         border-color:color-mix(in oklab, var(--warning) 40%, transparent)">⚠ <span>
      <b>${per.horsAtteinte.map(h => esc(h.label)).join(' et ')}${deuxPoints()}
      ${trad('cible impossible à atteindre ici.')}</b>
      ${trad('Tu en détiens')} ${per.horsAtteinte.map(h => fmtEUR0(h.montant)).join(' et ')},
      ${trad('mais sur un compte hors de cette base. La jauge restera à zéro quoi que '
        + 'tu achètes. Mets sa cible à 0, ou suis cette classe depuis Allocation.')}
    </span></div>` : ''}
    <div class="reeq-cadre"><ul class="reeq reeq-classes">
      <li class="reeq-groupe">${trad('Classes d’actif')}</li>
      ${r.classes.map(c => ligneReeq(c, c.cle)).join('')}
      ${r.cash ? `<li class="reeq-groupe reeq-groupe-suite">${trad('Trésorerie')}</li>
      ${ligneReeq(r.cash, CLE_TRESORERIE)}` : ''}
    </ul></div>
    <button class="btn sm ghost" data-action="ajouter-classe-cible"
            style="margin-top:12px">${trad('+ Suivre une classe')}</button>
    <dl class="kv reeq-pied">
      <dt>${BASES.placeBourse.nom}</dt><dd>${fmtEUR(r.invested.value)} <span class="muted">· ${fmtPct(r.invested.pct, 1)}</span></dd>
      <dt>${BASES.baseCibles.nom}<span class="sub">${trad('base des pourcentages ci-dessus')}</span></dt><dd>${fmtEUR(r.base)}</dd>
      ${per.montantDehors > 0 ? `<dt class="muted">${trad('Reste de')} ${BASES.avoirs.nom.toLowerCase()}${trad(', non arbitrable')}<span class="sub">${
        esc(dehorsDetail.map(([lib]) => lib).join(' · '))}${trad(', suivis dans l’')}<button type="button"
          class="mois-lien" data-action="sous-onglet" data-route="allocation"
          >${trad('onglet')} ${SOUS_ONGLETS.allocation[0][1]}</button></span></dt>
        <dd class="muted">${fmtEUR(per.montantDehors)}</dd>
      <dt>${BASES.avoirs.nom}</dt><dd>${fmtEUR(per.brut)}</dd>` : ''}
    </dl>
  </div>

  <div class="card">
    <div class="card-head"><h2>${ROLES.core} ${trad('et satellites')}${aide(trad("À l’intérieur de ce qui est placé en bourse : ce que tu alimentes sans le remettre en question, et ce que tu arbitres. Le core n’est pas de l’argent immobile, c’est souvent là qu’arrive l’essentiel des versements : c’est de l’argent que tu ne comptes pas vendre. C’est une lecture, pas un objectif : le plan de rééquilibrage ne vient que des classes. Poser une seconde série de cibles sur ce même argent pourrait la contredire sans que rien ne le signale."))}</h2></div>
    <p class="tete-legende">${mentionBase(BASES.baseCibles, rr.base)}</p>
    ${diagnosticRoles(rr)}
    <ul class="reeq">
      ${rr.roles.map(x => {
        const parts = rr.composition[x.cle] || [];
        return `
        <li class="reeq-ligne">
          <div class="reeq-haut">
            <span class="reeq-nom">${esc(x.label)}</span>
            <b class="reeq-val">${fmtEUR(x.value)} <span class="muted">· ${fmtPct(x.pct, 1)}</span></b>
          </div>
          ${(() => {
            const empile = parts.map(p =>
              `<i class="${p.nature === 'fonds' ? '' : 'raye'}"
                  style="width:${(x.value ? p.value / x.value * 100 : 0).toFixed(2)}%;--c:${p.couleur}"
                  title="${esc(p.label)} · ${fmtEUR0Texte(p.value)}"></i>`).join('');
            const dedans = empile
              ? `<span class="role-part" style="width:${Math.max(1.5, x.pct).toFixed(2)}%">${empile}</span>`
              : '<i class="vide"></i>';
            const ouvre = x.cle === CLE_TRESORERIE
              ? { apercu: 'cashCible', arg: 'investir', quoi: 'les poches de cash' }
              : positionsDeRole(x.cle) ? { apercu: 'role', arg: x.cle, quoi: 'les placements' }
                                       : null;
            return ouvre
              ? `<button type="button" class="role-barre-lien" data-action="apercu"
                         data-apercu="${esc(ouvre.apercu)}" data-arg="${esc(ouvre.arg)}"
                         aria-label="Voir ${ouvre.quoi} de ${esc(x.label)}"
                         ><span class="role-barre">${dedans}</span></button>`
              : `<div class="role-barre">${dedans}</div>`;
          })()}
          ${parts.length === 1 && parts[0].label === x.label ? '' : `
          <div class="role-legende">${parts.map(p =>
            `<span><i class="${p.nature === 'fonds' ? '' : 'raye'}" style="--c:${p.couleur}"></i>${
              esc(p.label)} ${fmtEUR0(p.value)}</span>`).join('')
            || `<span class="muted">${trad('aucune ligne')}</span>`}</div>`}
        </li>`;
      }).join('')}
    </ul>
    ${rr.parNature.some(n => n.nature === 'Titre en direct') ? `
      <p class="hint" style="margin:12px 0 0">
        ${trad('Hachuré : titre en direct. Plein : fonds.')}${aide(trad("La nature est déduite de l’instrument et se corrige dans la fiche de chaque ligne. Elle n’entre pas dans les cibles, qui portent sur la classe d’actif : sur le risque, pas sur l’enveloppe."))}
      </p>` : ''}
  </div>`;
}

function mountRebalance() {
}

let historyShowLegacy = false;
let historyYear = null;      // null = l'annee du dernier releve

function carteRythme() {
  return `
  <div class="card" data-anchor="rythme">
    <div class="card-head"><h2>${trad('Rythme d\'accumulation')}</h2>
      ${relevesRenseignes() >= 2 ? rangeControl('pace-range', paceRange) : ''}</div>
    <div class="rythme-cadre"><div class="rythme-corps">
    ${relevesRenseignes() >= 2 ? `<div class="chart" id="chartPace"></div>`
      : `<p class="empty" style="margin:0">${trad('Il faut deux relevés pour une pente : le premier ouvre la courbe, le second donne le rythme.')}</p>`}
    ${(() => {
      const p = statsRythme(limitRange(monthlyPace().points, paceRange, { ecarts: true }));
      if (!p.count) return '';
      return `<dl class="kv rythme-stats">
        ${p.apports ? `
        <dt>${trad('Dont')} ${p.apports < 0 ? trad('sorties exceptionnelles') : trad('entrées extérieures')}${aide(
            trad('Les entrées et sorties exceptionnelles de la période affichée : un héritage, une prime, la vente d’un bien, ou à l’inverse une voiture, des travaux. Elles déplacent ton patrimoine sans rien dire de ton épargne, et la moyenne du dessous les compte : hors elles, ton rythme propre est de')
          + ' ' + fmtEUR0(p.averageHorsApports) + ' ' + trad('par mois. Retrouve le journal dans Aperçu > Historique.'))}</dt>
          <dd><button type="button" class="mois-lien ${cls(p.apports)}" data-action="goto" data-view="history"
                      data-anchor="" title="${trad('Voir le journal des entrées et sorties exceptionnelles')}"
              >${fmtSigned(p.apports)}</button></dd>` : ''}
        <dt>${trad('Moyenne mensuelle du patrimoine')}${aide(trad("Ce que ton patrimoine net gagne ou perd par mois, sur la période affichée. Elle comprend les mouvements de marché et les apports, pas seulement ton épargne. Un mois sans relevé n’est pas oublié : l’écart entre deux relevés éloignés se répartit sur les mois qu’il a vraiment mis à arriver. Le mois en cours reste dehors : il est incomplet."))}
          <span class="sub">${trad('marchés et apports compris')}</span></dt><dd class="${cls(p.average)}">${fmtSigned(p.average)}</dd>
        ${(() => {
          const trou = num(p.mois) > p.count;
          return `
        <dt>${trad(trou ? 'Variations en hausse' : 'Mois en hausse')}</dt><dd>${p.positive} / ${p.count}</dd>
        ${p.best ? `<dt>${trad(trou ? 'Meilleure variation' : 'Meilleur mois')}</dt><dd>${esc(p.best.label)} · ${fmtSigned(p.best.delta)}</dd>` : ''}
        ${p.worst ? `<dt>${trad(trou ? 'Pire variation' : 'Pire mois')}</dt><dd>${esc(p.worst.label)} · ${fmtSigned(p.worst.delta)}</dd>` : ''}`;
        })()}
      </dl>`;
    })()}
    </div></div>
  </div>`;
}

function viewHistory() {
  const annees = historyYears();
  const anneeCourante = todayISO().slice(0, 4);
  if (historyYear === 'all') historyYear = null;   // le cran a quitte le selecteur

  const tous = [];
  for (let i = 0; i < Store.state.monthly.length; i++) {
    const r = Store.state.monthly[i];
    if (rowIsEmpty(r)) continue;
    const net = rowNet(r), total = rowTotal(r);
    const avant = tous[tous.length - 1];
    tous.push({ r, i, net, total, dlt: avant ? net - avant.net : 0,
                mois: avant ? moisEntre(avant.r.date, r.date) : 0 });
  }

  const anneeDernier = tous.length
    ? String(tous[tous.length - 1].r.date).slice(0, 4) : anneeCourante;
  const annee = historyYear ?? (annees.includes(anneeDernier) ? anneeDernier : anneeCourante);

  const lignes = tous.filter(x => String(x.r.date).startsWith(annee)).reverse();

  /* La geometrie des jauges, commune aux lignes affichees : normaliser chaque
     mois pour lui-meme donnerait douze barres de meme longueur, ce qui ne dit
     rien. L'echelle et la place du zero vivent dans `geometrieJauges`, cote
     modele, ou un test les exerce. Le chiffre exact reste ecrit a droite -- la
     jauge est une aide a la lecture, jamais la source. */
  const jauges = geometrieJauges(lignes.map(x => x.dlt));
  const attente = currentMonthPending();
  const vide = pasAFaire('comptes') || !tous.length || !lignes.length;

  return `
  ${(() => {
    if (!attente.missing || !tous.length) return '';
    return `<div class="note">⤒ <span><b>${esc(attente.label)} ${trad('n’est pas encore enregistré.')}</b>
      ${trad('Un relevé reprend d’un coup tous les montants actuels ({v}), et tient en un geste.')
        .replace('{v}', fmtEUR0(nowTotals().total))}</span>
      ${sortiesRappel('releve', attente.label,
        `<button class="btn sm" data-action="ajouter-releve">${trad('Enregistrer le relevé')}</button>`)}</div>`;
  })()}

  <div class="card">
    <div class="card-head tete-triple">
      <div class="tete-titre">
        <h2>${trad('Relevé mensuel du patrimoine')}</h2>
        ${lignes.length ? `<span class="hint">${
          (lignes.length > 1 ? trad('{n} relevés en {a}') : trad('{n} relevé en {a}'))
            .replace('{n}', lignes.length).replace('{a}', esc(String(annee)))}</span>` : ''}
      </div>
      ${lignes.some(x => x.mois > 0) ? (() => {
          /* Un seul calcul, lu deux fois : la couleur et le montant venaient de
             deux `reduce` identiques, et deux ecritures d'un meme nombre
             finissent par diverger le jour ou l'une est modifiee seule. */
          const variation = lignes.reduce((s, x) => s + x.dlt, 0);
          return `<div class="tete-variation">
        <span>${trad('Variation {a}').replace('{a}', esc(String(annee)))}</span>
        <b class="${cls(variation)}">${fmtSigned(variation)}</b>
      </div>`;
      })() : ''}
      <div class="row">
        ${annees.length > 1 ? yearControl('history-year', annees, annee) : ''}
        ${vide ? '' : `<button class="btn sm" data-action="ajouter-releve">${trad('Enregistrer un relevé')}</button>`}
      </div>
    </div>
    ${pasAFaire('comptes') ? `
    <p class="empty" style="margin:0 0 12px">${trad('Un relevé est la photo de tes comptes '
      + 'à une date : leur montant, mois par mois. C’est lui qui donne la courbe de ton '
      + 'patrimoine et ton rythme d’accumulation. Il attend donc un compte.')}</p>
    ${invitePremierPas('comptes')}`
    : !tous.length ? `
    <p class="empty" style="margin:0 0 10px">${trad('Aucun relevé mensuel pour le moment.')}
      ${trad('Un relevé est la photo de tes comptes à une date : la valeur de chaque poche, '
      + 'additionnée en un patrimoine total. Refais-le chaque mois, et la courbe de ton '
      + 'patrimoine se dessine.')}</p>
    <button class="btn sm" data-action="ajouter-releve">${trad('Enregistrer ton premier relevé')}</button>`
    : !lignes.length ? `
    <p class="empty" style="margin:0 0 10px">${trad('Aucun relevé en {a}.')
      .replace('{a}', esc(String(annee)))}
      ${trad('Le journal en compte {n} au total, sur les autres années.')
        .replace('{n}', tous.length)}</p>
    <button class="btn sm" data-action="ajouter-releve">${trad('Enregistrer un relevé')}</button>`
    : `
    ${annee === anneeCourante && attente.vide && !attente.missing ? `
    <p class="hint" style="margin:0 0 10px">${trad('Aucun relevé pour {m}.')
      .replace('{m}', esc(attente.label))}
      <button type="button" class="lien-nu" data-action="ajouter-releve"
              >${trad('Enregistrer le relevé')}</button></p>` : ''}
    <div class="liste-principale liste-jauges">
      ${lignes.map(({ r, i, net, dlt, mois }) => ligneListe({
        action: 'voir-releve', index: i,
        classe: r.date === attente.key ? 'mois-courant' : '',
        titre: fmtMonth(r.date),
        sous: [r.comment || '', mois > 1
          ? trad('écart sur {n} mois').replace('{n}', mois) : ''].filter(Boolean).join(' · '),
        valeur: fmtEUR0(net),
        second: dlt ? fmtSigned(dlt) : '', classeSecond: cls(dlt),
        jauge: jauges.longueur(dlt), jaugeZero: jauges.zero,
      })).join('')}
    </div>`}
  </div>

  ${(() => {
    const tout = apportsTries();
    const bornes = [`${annee}-01-01`, `${annee}-12-31`];
    const liste = tout.filter(a => String(a.date || '').startsWith(String(annee)));
    const d = apportsDetail(...bornes);
    if (!aUnComptePropre() && !tout.length) return '';
    return `
  <div class="card">
    <div class="card-head"><div class="tete-titre"><h2>${trad('Entrées et sorties exceptionnelles')}</h2>
      <span class="hint">${liste.length
        ? `${(liste.length > 1 ? trad('{n} lignes') : trad('{n} ligne'))
              .replace('{n}', liste.length)} · ${esc(String(annee))} · ${
            fmtSigned(d.net)} ${trad('net')}`
        : tout.length
          ? `${trad('aucune en')} ${esc(String(annee))} · ${
              trad('{n} au total').replace('{n}', tout.length)}`
          : trad('héritage, prime, vente d’un bien, ou une grosse dépense')}</span></div>
      <span class="paire-btn">
        <button class="btn sm ghost" data-action="ajouter-apport" data-sens="entree">${trad('+ Entrée')}</button>
        <button class="btn sm ghost" data-action="ajouter-apport" data-sens="sortie">${trad('+ Dépense')}</button>
      </span></div>
    ${tout.length && annees.length > 1 ? `<div class="carte-filtres">${yearControl('history-year', annees, annee)}</div>` : ''}
    ${!liste.length && !tout.length ? `
    <p class="small muted" style="margin:0">${trad('Rien pour l’instant. Une somme reçue ou dépensée '
      + 'une seule fois se note ici, avec sa date : le rythme d’accumulation sait alors que '
      + 'ce mois-là ne dit rien de ton épargne.')}</p>`
    : !liste.length ? `
    <p class="small muted" style="margin:0">${trad('Aucune ligne en {a}.').replace('{a}', esc(String(annee)))}
      Le journal en compte ${tout.length} au total : change l’année en tête de page.</p>`
    : `<details class="data-view" id="journalApports" ${journalOuvert ? 'open' : ''}>
      <summary>${trad('Voir le journal')}</summary>
      <div class="mlist-groupe" style="margin-top:12px">
      ${liste.map(a => `
        <button type="button" class="mlist" data-action="editer-apport" data-i="${a.index}"
                title="${trad('Modifier cette ligne')}">
          <span class="ml-nom">${esc(a.libelle || trad(a.montant < 0 ? 'Dépense' : 'Entrée'))}
            <span class="sub">${esc([fmtJourMois(a.date) || a.date || 'sans date',
              a.note || ''].filter(Boolean).join(' · '))}</span></span>
          <span class="ml-chiffres"><b class="${cls(a.montant)}">${fmtSigned(a.montant)}</b></span>
          <span class="ml-chev" aria-hidden="true">›</span>
        </button>`).join('')}
      </div>
    </details>
    <dl class="kv" style="margin-top:12px">
      ${d.entrees ? `<dt>${trad('Entrées')}</dt><dd class="up">${fmtSigned(d.entrees)}</dd>` : ''}
      ${d.sorties ? `<dt>${trad('Sorties')}</dt><dd class="down">${fmtSigned(d.sorties)}</dd>` : ''}
      <dt>${trad('Net')}${aide(trad("La somme de tes entrées et de tes sorties exceptionnelles sur l’année affichée. Elle ne s’ajoute à aucun total de patrimoine : ces montants sont déjà passés sur tes comptes, c’est leur origine que ce journal garde en mémoire. Le rythme d’accumulation s’en sert pour distinguer ce que tu as mis de côté de ce qui t’est tombé du ciel, ou de ce qui est parti d’un coup. Une grosse dépense se note ici et non dans les dépenses du mois : là-bas elle gonflerait ta moyenne toute l’année, et avec elle le coût de la vie qui sert à ta réserve de sécurité et à sa cible."))}</dt>
        <dd class="${cls(d.net)}">${fmtSigned(d.net)}</dd>
    </dl>`}
  </div>`;
  })()}

  ${aUnComptePropre() ? carteRythme() : ''}`;
}

function mountHistory() {
  const j = $('#journalApports');
  if (j) j.addEventListener('toggle', () => { journalOuvert = j.open; });
  monterRythme();
}

partieChargee('assets/app-04-cours-automatiques.js');
