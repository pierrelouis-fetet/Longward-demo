/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */
Object.assign(ACTIONS, {
  /* Changer d'angle ne change pas de page : la position reste, et seul
     l'angle choisi se rend et se monte. Il entre comme une arrivee, mais dans
     sa section seulement : son contenu monte, l'anneau se remplit et les barres
     poussent.

     Le minuteur retire les classes de CETTE section, et non de celle qui sera
     dans la page a son echeance : un second clic rapide rend une section neuve,
     que le minuteur du premier ne doit pas couper en pleine animation. Il sert
     parce que `Charts.mount` redessine au redimensionnement, et que des barres
     neuves sous `.graphes-poussent` repousseraient. Meme duree que la pousse
     posee par render(). */
  'alloc-angle'(btn) {
    const v = btn && btn.dataset ? btn.dataset.angle : '';
    if (!v || v === allocAngle) return;
    retourHaptique();
    allocAngle = v;
    allocAngleEntre = true;
    render();
    allocAngleEntre = false;
    const section = $('section.alloc-angle');
    if (section) setTimeout(() => section.classList.remove('angle-entre', 'graphes-poussent'), 750);
    const b = $(`[data-action="alloc-angle"][data-angle="${v}"]`);
    if (b) b.focus({ preventScroll: true });
  },
  'repart-autres'(btn) {
    const detail = $('#repartAutresDetail');
    if (!detail) return;
    repartAutresOuvert = detail.hidden;
    detail.hidden = !repartAutresOuvert;
    btn.setAttribute('aria-expanded', String(repartAutresOuvert));
  },
  /* Decouper une classe en deux cibles, une par role. Le partage au prorata est
     dans `partageDeCible()`, cote store, pour qu'un test l'exerce vraiment. */
  'decouper-classe'(btn) {
    const cle = btn.dataset.cle;
    const tg = Store.state.targets.classes || (Store.state.targets.classes = {});
    if (tg[cle] !== null && typeof tg[cle] === 'object') return;
    tg[cle] = partageDeCible(tg[cle], stockTotals().parClasseRole?.[cle]);
    Store.save(); render();
    toast(`${ASSET_CLASSES[cle]} · ${ROLES.core} ${tg[cle].core} % ${trad('et')} ${ROLES.satellite.toLowerCase()} ${tg[cle].satellite} %`);
  },

  'refusionner-classe'(btn) {
    const cle = btn.dataset.cle;
    const tg = Store.state.targets.classes || {};
    const v = tg[cle];
    if (v === null || typeof v !== 'object') return;
    tg[cle] = Object.values(v).reduce((s, x) => s + num(x), 0);
    Store.save(); render();
    toast(`${ASSET_CLASSES[cle]} · ${trad('une seule cible,')} ${tg[cle]} %`);
  },

  async 'ajouter-classe-cible'() {
    const cibles = Store.state.targets;
    const tg = cibles.classes || (cibles.classes = {});
    const r = rebalanceRows();
    const visibles = r.classes.map(c => c.cle.split('.')[1]);
    const sorties = r.exclues.map(x => x.cle);
    const libres = Object.entries(ASSET_CLASSES)
      .filter(([k]) => !visibles.includes(k))
      .map(([k, label]) => [k, sorties.includes(k)
        ? `${label} ${trad('(sortie, à remettre)')}` : label]);
    if (!libres.length) { toast(trad('Toutes les classes sont déjà suivies')); return; }
    const somme = sommeCibles();
    const premiere = libres[0][0];
    const gardee = cibles.ciblesRetirees && cibles.ciblesRetirees[premiere];
    const v = await askForm({
      titre: trad('Suivre une classe'),
      sous: `Tes cibles totalisent ${somme} %. Une somme de 100 % rend les montants cibles exacts.`,
      ok: 'Suivre',
      champs: [
        { cle: 'classe', label: trad('Classe d’actif'), type: 'liste', options: libres, valeur: premiere },
        { cle: 'cible', label: 'Cible', type: 'nombre',
          valeur: gardee !== undefined ? sommeCibleDe(gardee) : 0,
          aide: trad('en % du portefeuille, modifiable ensuite dans la liste') },
      ],
    });
    if (!v) return;
    if (sorties.includes(v.classe)) {
      cibles.exclues = (cibles.exclues || []).filter(x => x !== v.classe);
      if (cibles.ciblesRetirees) delete cibles.ciblesRetirees[v.classe];
    }
    tg[v.classe] = Math.max(0, Math.min(100, num(v.cible)));
    Store.save(); render();
    toast(`${ASSET_CLASSES[v.classe]} · ${trad('cible')} ${tg[v.classe]} %`);
  },
  /* Sortir une classe du reequilibrage. Son encours quitte la base — sinon les
     pourcentages ne totaliseraient plus 100 % sans explication.

     Sa cible est mise de cote au lieu d'etre ecrasee. Elle retombait a zero, et
     un decoupage par role partait avec : « 70 % de core, 20 % de satellite »
     devenait `0`, un seul nombre, et remettre la classe rendait une ligne a
     zero. Un geste reversible ne doit rien detruire en chemin. */
  /* La tresorerie passe par les memes deux actions que les classes. Sa cible ne
     vit pas dans `classes` mais a la racine, `targets.cashToInvest` : ce petit
     detour est le prix de ne pas dupliquer tout le mecanisme d'exclusion. */
  'retirer-classe-cible'(btn) {
    const k = btn.dataset.cle;
    const tg = Store.state.targets;
    const tresorerie = k === CLE_TRESORERIE;
    tg.exclues = [...new Set([...(tg.exclues || []), k])];
    const cible = tresorerie ? tg.cashToInvest : (tg.classes || {})[k];
    if (cible !== undefined && cible !== 0) {
      tg.ciblesRetirees = tg.ciblesRetirees || {};
      tg.ciblesRetirees[k] = cible;
    }
    if (tresorerie) tg.cashToInvest = 0;
    else if (tg.classes) tg.classes[k] = 0;
    Store.save(); render();
    toast(`${nomDeLaCible(k)} ${trad('sortie du rééquilibrage, sa cible est gardée')}`);
  },
  'reintegrer-classe'(btn) {
    const k = btn.dataset.cle;
    const tg = Store.state.targets;
    tg.exclues = (tg.exclues || []).filter(x => x !== k);
    const gardee = tg.ciblesRetirees && tg.ciblesRetirees[k];
    if (gardee !== undefined && gardee !== null) {
      if (k === CLE_TRESORERIE) tg.cashToInvest = gardee;
      else (tg.classes || (tg.classes = {}))[k] = gardee;
      delete tg.ciblesRetirees[k];
    }
    Store.save(); render();
    toast(`${nomDeLaCible(k)} ${trad('de retour')}${gardee !== undefined && gardee !== null
      ? `, cible ${sommeCibleDe(gardee)} %` : ''}`);
  },
  'pf-autres'(btn) {
    const table = btn.closest('table');
    if (!table) return;
    pfAutresOuvert = !table.classList.contains('autres-ouvert');
    table.classList.toggle('autres-ouvert', pfAutresOuvert);
    btn.setAttribute('aria-expanded', String(pfAutresOuvert));
  },
  'pf-toutes'(btn) {
    const table = btn.closest('table');
    if (!table) return;
    pfToutesOuvert = !table.classList.contains('tout-voir');
    table.classList.toggle('tout-voir', pfToutesOuvert);
    btn.setAttribute('aria-expanded', String(pfToutesOuvert));
  },
  'alloc-base'(btn) {
    const voulu = btn.dataset.base === 'financier';
    if (voulu === allocFinancier) return;
    allocFinancier = voulu;
    allocTransition = true;
    relanceGraphes = true;
    render();
  },
});

partieChargee('assets/app-08-actions-allocation.js');
