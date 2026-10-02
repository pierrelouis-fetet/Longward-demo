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
  async 'appliquer-modele-cible'(btn) {
    await poserModeleCible(btn.dataset.modele);
  },
  async 'choisir-modele-cible'() {
    const id = await askOptions({ titre: trad('Partir d’un modèle'),
      sous: trad('Des exemples courants, pas un conseil : tu choisis, et chaque pourcentage reste modifiable.'),
      options: MODELES_CIBLES.map(m => ({ v: m.id, l: trad(m.nom), sous: `${compositionModele(m)} · ${trad(m.phrase)}` })) });
    if (id) await poserModeleCible(id);
  },
  'garder-cibles-origine'() {
    Store.state.targets.origineRevue = true;
    Store.save(); render();
    toast(trad('Cibles gardées'));
  },
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

  /* LE DETAIL D'UNE SOCIETE. Chaque participation, sa plateforme, sa valeur et
     le credit de son compte ; l'exposition brute ; le net apres credit quand il
     se calcule sans supposition. On y renomme la societe, et decocher une
     participation la dissocie : elle retrouve sa propre ligne dans l'analyse,
     et rien d'autre ne bouge, ni sa fiche ni ses operations.

     Les montants passent par `fmtEUR0Texte` : un libelle de formulaire est du
     texte, et le masque des montants y reste lisible. */
  async 'societe-detail'(btn) {
    const id = btn && btn.dataset ? btn.dataset.i : '';
    const g = groupesSocietes({ financier: allocFinancier }).find(x => x.id === id);
    if (!g) return;
    const base = valeurAvoirsAlloc();
    const de = baseAvoirsAlloc().de;
    const creditDe = p => g.credits.find(k => k.compte === p.compte);
    const v = await askForm({
      titre: g.nom,
      sous: trad('Décoche une participation pour la dissocier : elle garde sa fiche et sa valeur.'),
      ok: 'Enregistrer',
      champs: [
        { cle: 'nom', label: trad('Nom de la société'), type: 'texte', requis: true,
          max: NOM_SOCIETE_MAX, valeur: g.nom },
        { cle: 'section_parts', label: trad('Participations regroupées'), type: 'section' },
        ...g.participations.map((p, k) => {
          const kc = creditDe(p);
          return { cle: `garder_${k}`, type: 'case', valeur: true,
                   label: `${p.libelle} · ${fmtEUR0Texte(p.valeur)}`,
                   aide: [lieuParticipation(p),
                          kc ? `${trad('crédit de son compte')} ${fmtEUR0Texte(kc.du)}` : '']
                     .filter(Boolean).join(' · ') };
        }),
        { cle: 'section_expo', label: trad('Exposition'), type: 'section' },
        { cle: 'lecture_brut', label: trad('Exposition brute'), lecture: true,
          valeur: `${fmtEUR0Texte(g.valeur)}${base > 0.005 ? ` · ${fmtPct(g.valeur / base * 100, 1)} ${de}` : ''}`,
          aide: trad('la somme des participations, sans rien retrancher : c’est ce que tu perdrais si la société ne valait plus rien') },
        ...(g.netApresCredit !== null
          ? [{ cle: 'lecture_net', label: trad('Net après crédit'), lecture: true,
               valeur: fmtEUR0Texte(g.netApresCredit),
               aide: trad('le crédit de ces comptes ne finance que cette société : il se retranche ici, et nulle part ailleurs dans cette analyse') }]
          : g.credits.length
            ? [{ cle: 'lecture_credit', label: trad('Crédit sur ces comptes'), lecture: true,
                 valeur: g.credits.map(k => `${nomCompteV2(k.compte)} · ${fmtEUR0Texte(k.du)}`).join(', '),
                 aide: trad('ces comptes portent aussi autre chose : la part de ce crédit qui finance la société ne se connaît pas, il ne se retranche donc de rien') }]
            : []),
      ],
    });
    if (!v) return;
    renommerSociete(g.id, v.nom);
    let partis = 0;
    g.participations.forEach((p, k) => {
      if (!v[`garder_${k}`] && dissocierParticipation(p.cle)) partis++;
    });
    Store.save(); render();
    toast(partis ? `${partis} ${trad(partis > 1 ? 'participations dissociées' : 'participation dissociée')}`
                 : trad('Société enregistrée'));
  },

  async 'societe-rapprocher'(btn) {
    const a = entiteParCle(btn.dataset.a), b = entiteParCle(btn.dataset.b);
    if (!a || !b) return;
    let nom = '';
    if (a.societe && b.societe) {
      const n = a.participations.length + b.participations.length;
      const ok = await askConfirm(`${trad('Fusionner {a} et {b}')
          .replace('{a}', guill(a.societe.nom)).replace('{b}', guill(b.societe.nom))} ?\n`
        + trad('Leurs {n} participations formeront une seule société, sous le nom {a}. Chacune garde sa fiche, ses opérations et sa valeur.')
          .replace('{n}', n).replace('{a}', guill(a.societe.nom)),
        { ok: 'Fusionner', danger: false });
      if (!ok) return;
    } else if (!a.societe && !b.societe) {
      const v = await askForm({
        titre: 'Même société',
        sous: `${guill(nomEntite(a))} · ${guill(nomEntite(b))}`,
        ok: 'Regrouper',
        champs: [{ cle: 'nom', label: trad('Nom de la société'), type: 'texte', requis: true,
                   max: NOM_SOCIETE_MAX, valeur: nomSocietePropose(nomEntite(a)),
                   aide: trad('les deux participations se somment sous ce nom dans l’analyse de concentration, et chacune garde sa fiche') }],
      });
      if (!v) return;
      nom = v.nom;
    }
    const id = confirmerRapprochement(a, b, nom);
    if (!id) return;
    Store.save(); render();
    const g = groupesSocietes().find(x => x.id === id);
    toast(`${guill(societeParId(id).nom)} · ${nombreParticipations(g ? g.participations.length : 2)}`);
    focusRapprochementSuivant();
  },

  'societe-ecarter'(btn) {
    const a = entiteParCle(btn.dataset.a), b = entiteParCle(btn.dataset.b);
    if (!a || !b) return;
    ecarterRapprochement(a, b);
    Store.save(); render();
    toast(trad('Deux sociétés : cette proposition ne reviendra plus'));
    focusRapprochementSuivant();
  },
});

function focusRapprochementSuivant() {
  const suivant = $('.rapprochements [data-action="societe-rapprocher"]')
    || $('.societes [data-action="societe-detail"]');
  if (suivant) suivant.focus({ preventScroll: true });
}

const SOCIETE_NOUVELLE = '__nouvelle';
function champsSociete(c, l) {
  if (!estCompteDeParts(c)) return [];
  const prises = societesTenues();
  const tenues = societesDeclarees().filter(x => prises.has(x.id));
  return [
    { cle: 'societe', label: trad('Société sous-jacente'), type: 'liste',
      valeur: societeParId(l.societeId) ? l.societeId : '',
      options: [['', trad('Aucune, elle compte seule')], ...tenues.map(x => [x.id, x.nom]),
                [SOCIETE_NOUVELLE, trad('Nouvelle société…')]],
      aide: trad('les participations d’une même société se somment dans l’analyse de concentration') },
    { cle: 'societeNom', label: trad('Nom de la société'), type: 'texte', max: NOM_SOCIETE_MAX,
      valeur: nomSocietePropose(l.libelle), montreSi: v => v.societe === SOCIETE_NOUVELLE },
  ];
}
function appliquerChoixSociete(c, i, v) {
  if (!estCompteDeParts(c) || v.societe === undefined) return;
  const l = (c.lignes || [])[i];
  if (!l) return;
  const cle = clesDeLignes(c)[i];
  if (v.societe === SOCIETE_NOUVELLE) {
    const id = creerSociete(v.societeNom || nomSocietePropose(l.libelle));
    if (id) rattacherASociete([cle], id);
  } else if (v.societe) {
    if (v.societe !== l.societeId) rattacherASociete([cle], v.societe);
  } else if (l.societeId) {
    dissocierParticipation(cle);
  }
}

async function poserModeleCible(id) {
  const effet = effetModeleCibles(id);
  if (!effet) return;
  if (etatCibles() !== 'aucune') {
    const noms = cles => cles.map(k => ASSET_CLASSES[k] || k).join(', ');
    const details = [
      effet.regroupees.length ? trad('{c} retrouve une seule cible, sans partage core et satellite.').replace('{c}', noms(effet.regroupees)) : '',
      effet.effacees.length ? trad('{c} n’a plus de cible, ni de partage core et satellite.').replace('{c}', noms(effet.effacees)) : '',
      effet.reintegrees.length ? trad('{c} revient dans le rééquilibrage.').replace('{c}', noms(effet.reintegrees)) : '',
    ].filter(Boolean).join('\n');
    if (!await askConfirm(`${trad('Remplacer tes cibles actuelles par « {m} » ?').replace('{m}', trad(effet.modele.nom))}\n\n${
      compositionModele(effet.modele)}${details ? `\n\n${details}` : ''}`, { ok: 'Remplacer', danger: false })) return;
  }
  const avant = structuredClone(Store.state);
  appliquerModeleCibles(id);
  Store.addBackup('avant un modèle de cibles', avant);
  Store.save(); render();
  toast(`${trad(effet.modele.nom)} · ${compositionModele(effet.modele)}`);
}

partieChargee('assets/app-08-actions-allocation.js');
