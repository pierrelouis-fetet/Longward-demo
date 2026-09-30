/*! Longward — personal wealth dashboard
 *  Copyright (C) 2026 Longward
 *  Licensed under the GNU Affero General Public License, version 3 or later.
 *  Source: https://github.com/pierrelouis-fetet/Longward-demo
 *  Distributed WITHOUT ANY WARRANTY. See the LICENSE file for the full terms.
 */
Object.assign(ACTIONS, {

  async 'supprimer-compte-clos'(btn) {
    /* `clos` seulement, jamais `archives` : un compte qui se rouvre ne se
       supprime pas ici. La meme regle est posee cote modele par
       `supprimerCompteClos`, et les deux se valent — l'absence d'un bouton ne
       protege que ce qu'on voit. */
    const x = comptesAnciens().clos.find(a => a.id === btn.dataset.id);
    if (!x) return;
    if (!await askConfirm(
      trad('Supprimer définitivement ce compte clos ?') + '\n\n' + x.label + '\n\n'
      + (x.mois.length
          ? trad('Les {m} relevés qui le mentionnent gardent leur total : la ventilation de chaque mois est gravée avant la suppression.')
              .replace('{m}', x.mois.length)
          : trad('Les relevés déjà enregistrés restent conservés selon les règles actuelles.'))
      + '\n\n' + trad('Une sauvegarde est prise avant, et Ctrl+Z annule.'),
      { ok: 'Supprimer', danger: true })) return;
    Store.addBackup('avant suppression d’un compte clos');
    if (!supprimerCompteClos(x.id)) return;
    Store.save();
    render();
    toast(`${guill(x.label)} ${trad('supprimé')}`);
  },

  /* Corriger le type d'un compte. La regle vit dans `changementDeTypePossible`,
     cote store, pour qu'un test l'exerce : c'est elle qui empeche un Livret A de
     se retrouver a detenir des actions.

     Un refus repose la liste sur l'ancienne valeur. Sans cela le menu resterait
     sur un type que l'etat n'a pas pris, et le prochain rendu le corrigerait
     dans le dos — on aurait vu son choix s'annuler tout seul, sans raison. */
  'changer-type-compte'(sel) {
    const c = compteById(sel.dataset.id);
    if (!c) return;
    const cible = sel.value;
    const v = changementDeTypePossible(c, cible);
    if (!v.ok) { sel.value = c.type; toast(v.raison); return; }
    if (v.sansChangement) return;
    const avant = typeCompte(c.type).label;
    c.type = cible;
    Store.save(); render();
    toast(`${nomCompteV2(c)} : ${avant} ${trad('devient')} ${trad(typeCompte(cible).label)}`);
  },

  async 'modifier-etab'(btn) {
    const e = etabById(btn.dataset.id);
    if (!e) return;
    const mot = contenantDeLEtab(e.id);
    const siens = COMPTES().filter(c => c.etabId === e.id && c.statut !== 'archive');
    const v = await askForm({
      titre: trad('Modifier l’établissement'), sous: e.nom, ok: 'Enregistrer',
      champs: [
        { cle: 'nom', label: 'Nom', type: 'texte', requis: true,
          valeur: e.nom, exemple: 'ex. ta banque en ligne' },
        { cle: 'type', label: 'Type', type: 'texte', valeur: trad(mot.titre), lecture: true,
          aide: siens.length
            ? (siens.length === 1
                ? trad('déduit de son compte : {types}. Pour le changer, change ce qu’il contient.')
                : trad('déduit de ses {n} comptes : {types}. Pour le changer, change ce qu’il contient.')
                    .replace('{n}', siens.length))
                .replace('{types}', siens.map(c => trad(typeCompte(c.type).label)).join(', '))
            : trad('aucun compte rattaché pour l’instant, donc le terme le plus large') },
        { cle: 'notes', label: 'Notes', type: 'texte', valeur: e.notes || '',
          exemple: 'ex. le numéro du conseiller, la date du prochain point',
          aide: trad('facultatif') },
      ],
    });
    if (!v) return;
    e.nom = v.nom.trim();
    const tous = COMPTES().filter(x => x.etabId === e.id);
    if (tous.length === 1 && estDetenuEnDirect(typeCompte(tous[0].type))
        && (tous[0].lignes || []).length === 1 && !(tous[0].cash || []).length) {
      tous[0].lignes[0].libelle = e.nom;
      if (tous[0].libelle) tous[0].libelle = e.nom;
    }
    /* Une note vide efface la cle plutot que d'ecrire une chaine vide : c'est ce
       que fait `setPath` pour la saisie directe, et deux regimes d'effacement sur
       le meme champ finiraient par se contredire. */
    if (v.notes.trim()) e.notes = v.notes.trim(); else delete e.notes;
    Store.save(); render();
    toast(`${e.nom} ${trad('enregistré')}`);
  },

  async 'modifier-compte'(btn) {
    const c = compteById(btn.dataset.id);
    if (!c) return;
    const t = typeCompte(c.type);
    let saisi = null;

    for (;;) {
      const valeur = (cle, defaut) => (saisi ? saisi[cle] : defaut);
      const champs = [{ cle: 'libelle', label: `${trad('Nom du')} ${motCompte(typeCompte(c.type))}`, type: 'texte',
        valeur: valeur('libelle', c.libelle || ''), exemple: t.label }];

      if (!t.interne) champs.push({ cle: 'type', label: `${trad('Type de')} ${motCompte(t)}`, type: 'liste',
        options: [...typesCompteParRubrique(),
                  ['__nouveau', trad('+ Autre type…')]],
        valeur: valeur('type', c.type),
        aide: trad('il commande la poche du patrimoine et la disponibilité') });

      if (!t.interne && !t.sansEtab) {
        const typeVise = saisi && saisi.type && saisi.type !== '__nouveau' ? saisi.type : c.type;
        const mot = contenantDuType(typeVise);
        const compatibles = etablissementsProposables(typeVise, c.etabId).map(x => x.etab);
        champs.push({ cle: 'etab', label: trad(mot.titre), type: 'liste',
          options: [...compatibles.map(e => [e.id, e.nom]), ['__nouveau', `+ ${trad(mot.nouveau)}…`]],
          valeur: valeur('etab', c.etabId || compatibles[0]?.id || '__nouveau'),
          aide: trad('un crédit se pose sur ce niveau : deux biens rattachés au même le partagent') });
      }

      /* Un montant et non un pourcentage : la clef `plafond` se lit `pct` par
         defaut, et 22 950 depassait la borne de cent. */
      if (t.id === 'livret') champs.push({ cle: 'plafond', label: trad('Plafond de versement ({dev})'),
        type: 'nombre', genre: 'montant', valeur: valeur('plafond', num(c.plafond) || ''), exemple: 'ex. 22950',
        aide: trad('facultatif') });

      if (!t.interne) champs.push(
        { cle: 'ouvertLe', label: motDateCompte(typeCompte(c.type)), type: 'date',
          valeur: valeur('ouvertLe', c.ouvertLe || ''),
          aide: t.dateSensible ? trad('elle donne l’ancienneté, que la fiche affiche : cinq ans pour un PEA, huit pour une assurance-vie')
                               : trad('facultatif') },
        ...(t.echeanceUnique ? [{ cle: 'debloqueLe', label: trad('Déblocage prévu'), type: 'date',
          valeur: valeur('debloqueLe', c.debloqueLe || ''),
          aide: trad('facultatif : la date à laquelle tu prévois de récupérer cet argent, ta retraite en général') }] : []),
        { cle: 'notes', label: 'Notes', type: 'texte',
          valeur: valeur('notes', c.notes || ''),
          exemple: trad('facultatif') },
        { cle: 'numero', label: trad('Numéro de compte'), type: 'texte',
          valeur: valeur('numero', c.numero || ''), aide: trad('facultatif') });

      if (c.statut === 'archive') champs.push(
        { cle: 'clotureLe', label: trad('Date de clôture'), type: 'date',
          valeur: valeur('clotureLe', c.clotureLe || ''),
          aide: trad('facultative, elle situe le compte dans le temps') });

      const v = await askForm({ titre: `${trad('Modifier le')} ${motCompte(typeCompte(c.type))}`, sous: nomCompteV2(c),
                                champs, ok: 'Enregistrer' });
      if (!v) return;

      if (v.type === '__nouveau') {
        const id = await demanderTypePerso();
        if (!id) { saisi = v; continue; }
        v.type = id;
      }

      if (v.type && v.type !== c.type) {
        const verdict = changementDeTypePossible(c, v.type);
        if (!verdict.ok) { toast(verdict.raison); saisi = v; continue; }
      }
      const etabFinal = 'etab' in v ? v.etab : c.etabId;
      if (etabFinal && etabFinal !== '__nouveau'
          && !etablissementAccepte(etabFinal, v.type || c.type, c.id)) {
        toast(trad('{t} ne se tient pas chez {e}, qui porte des comptes d’une autre nature : choisis un autre établissement.')
          .replace('{t}', trad(typeCompte(v.type || c.type).label)).replace('{e}', etabById(etabFinal)?.nom || ''));
        saisi = v; continue;
      }

      /* Un champ vide efface, il n'ecrit pas une chaine vide : c'est ce que
         fait `setPath` pour la saisie directe, et deux regimes d'effacement
         sur les memes champs finiraient par se contredire. */
      const pose = (cle, val) => {
        if (val === '' || val == null || val === 0) delete c[cle]; else c[cle] = val;
      };
      const avant = typeCompte(c.type).label;
      const typeChange = v.type && v.type !== c.type;

      if ('etab' in v && v.etab !== c.etabId) {
        let cible = v.etab;
        if (cible === '__nouveau') {
          const mot = contenantDuType(v.type || c.type);
          const nom = await askText(trad(mot.nouveau),
            trad('Son nom, tel qu’il s’affichera partout.'), trad(mot.exemple));
          if (!nom) { saisi = v; continue; }
          const slug = nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'etab';
          let id = 'e_' + slug, n = 2;
          while (etabById(id)) id = 'e_' + slug + (n++);
          Store.state.etabs.push({ id, nom, notes: '', dettes: [] });
          cible = id;
        }
        c.etabId = cible;
      }

      pose('libelle', String(v.libelle || '').trim());
      /* Un bien porte un seul nom, et il vit a deux endroits.

         Le compte et sa ligne unique sont la meme chose : le parcours de
         creation les ecrit ensemble, `nomCompteV2()` et `nomLignePlacement()`
         se replient l'un sur l'autre pour l'afficher. Renommer par cette fenetre
         ne touchait que le compte, et la fiche montrait alors « Studio Lyon 7e »
         en titre au-dessus d'une ligne « studio lyon » : deux noms pour une
         chose, ce que ce projet refuse partout ailleurs.

         La garde tient en trois conditions : un actif TERMINAL, une seule
         ligne, aucune espece. Terminal et non « detenu en direct » : une
         participation non cotee est tenue par un tiers et n'est pourtant pas
         davantage divisible qu'un appartement, le compte y EST le placement de
         la meme facon. Restreinte au direct, la regle laissait une part de
         societe porter deux noms qui divergeaient en silence. Des qu'un compte
         porte deux placements, chacun a son nom propre et rien ne l'ecrase. */
      if (estActifTerminal(typeCompte(c.type))
          && (c.lignes || []).length === 1 && !(c.cash || []).length
          && String(v.libelle || '').trim()) {
        c.lignes[0].libelle = String(v.libelle).trim();
        /* Le contenant est le troisieme exemplaire du meme nom, et LUI reste
           reserve au direct : un bien detenu en direct EST son contenant, et la
           carte de la liste des actifs affiche `etab.nom`. Une participation
           non cotee, non — son contenant est le courtier qui la tient, et le
           renommer du nom de la part serait faux meme s'il n'en tenait qu'une.
           Seconde condition, inchangee : seulement quand l'etablissement n'a
           que ce compte, un parking rattache au meme contenant garde son nom. */
        const etab = estDetenuEnDirect(typeCompte(c.type)) ? etabById(c.etabId) : null;
        if (etab && COMPTES().filter(x => x.etabId === etab.id).length === 1) {
          etab.nom = String(v.libelle).trim();
        }
      }
      if (v.type) c.type = v.type;
      if ('plafond' in v) pose('plafond', num(v.plafond) || 0);
      if ('ouvertLe' in v) pose('ouvertLe', v.ouvertLe);
      if ('ouvertLe' in v && estActifTerminal(typeCompte(c.type))
          && (c.lignes || []).length === 1 && !(c.cash || []).length) {
        c.lignes[0].dateAcquisition = v.ouvertLe || '';
      }
      if ('clotureLe' in v) pose('clotureLe', v.clotureLe);
      if ('debloqueLe' in v) pose('debloqueLe', v.debloqueLe);
      if ('numero' in v) pose('numero', String(v.numero || '').trim());
      if ('notes' in v) pose('notes', String(v.notes || '').trim());

      Store.save(); render();
      toast(typeChange
        ? `${nomCompteV2(c)} : ${trad(avant)} ${trad('devient')} ${trad(typeCompte(c.type).label)}`
        : `${nomCompteV2(c)} ${trad('enregistré')}`);
      return;
    }
  },
  'compte-vue'(btn) {
    retourHaptique();
    tapeSousOnglets = true;
    compteVue = btn.dataset.vue;
    render();
  },
  'replier-groupe'(btn) {
    const cle = btn.dataset.cle;
    const ouvre = compteReplies.has(cle);          // etat d'avant : replie, donc on ouvre
    ouvre ? compteReplies.delete(cle) : compteReplies.add(cle);
    memoriserReplies();
    const groupe = btn.closest('.cpt-groupe');
    const pli = groupe?.querySelector('.cpt-pli');
    if (!pli) { render(); return; }
    pli.classList.toggle('ouvert', ouvre);
    groupe.classList.toggle('replie', !ouvre);
    btn.setAttribute('aria-expanded', String(ouvre));
    const chev = groupe.querySelector('.cpt-chev');
    if (chev) chev.textContent = ouvre ? '⌄' : '›';
  },
  'plier-tout'() {
    const cles = groupesRendus;
    const tousReplies = cles.length && cles.every(c => compteReplies.has(c));
    for (const c of cles) tousReplies ? compteReplies.delete(c) : compteReplies.add(c);
    memoriserReplies();
    let animeTout = true;
    for (const b of $$('.cpt-gplier[data-cle]')) {
      const groupe = b.closest('.cpt-groupe');
      const pli = groupe?.querySelector('.cpt-pli');
      if (!pli) { animeTout = false; break; }
      pli.classList.toggle('ouvert', tousReplies);
      groupe.classList.toggle('replie', !tousReplies);
      b.setAttribute('aria-expanded', String(tousReplies));
      const chev = groupe.querySelector('.cpt-chev');
      if (chev) chev.textContent = tousReplies ? '⌄' : '›';
    }
    if (!animeTout) render();
  },

  'liq-plier'(btn) {
    const section = btn.closest('.liq-groupe');
    const pli = section?.querySelector('.cpt-pli');
    if (!pli) return;
    const ouvert = !pli.classList.contains('ouvert');
    pli.classList.toggle('ouvert', ouvert);
    btn.setAttribute('aria-expanded', String(ouvert));
    const cle = btn.dataset.cle;
    if (cle) {
      if (ouvert) compteReplies.delete(cle); else compteReplies.add(cle);
      memoriserReplies();
    }
    majBoutonLiqTout(btn.closest('#modal'));
  },
  'liq-plier-tout'(btn) {
    const corps = btn.closest('#modal');
    const plis = $$('.liq-groupe .cpt-pli', corps);
    const ouvrir = !plis.some(p => p.classList.contains('ouvert'));
    for (const p of plis) {
      p.classList.toggle('ouvert', ouvrir);
      const s = p.closest('.liq-groupe')?.querySelector('.liq-sommaire');
      if (s) {
        s.setAttribute('aria-expanded', String(ouvrir));
        if (s.dataset.cle) {
          if (ouvrir) compteReplies.delete(s.dataset.cle); else compteReplies.add(s.dataset.cle);
        }
      }
    }
    memoriserReplies();
    majBoutonLiqTout(corps);
  },

  /* Création en trois étapes — une décision par écran. Les champs
     secondaires (numéro, notes) vivent dans la fiche ; seule la date
     d'ouverture d'une enveloppe a seuil est demandée ici, parce qu'elle donne
     l'anciennete que sa fiche affiche. Elle ne commande aucune disponibilite :
     ces seuils sont fiscaux, et `mobilisabilite()` ne lit aucune date. */
  /* `data-etab` : depuis la fiche d'un établissement, le contenant est déjà
     connu. On saute l'étape 2 plutôt que de faire rechoisir son établissement
     à quelqu'un qui est justement sur la page de cet établissement. */
  /* Une enveloppe sans poche de cash (`sansCash`) se souscrit chez un assureur,
     ou s'ouvre chez un teneur de compte : un 401(k) est un PLAN, pas un
     contrat. Le mot suit le contenant declare, comme la fiche du compte. */
  async 'ajouter-compte'(btn) {
    if (!await devisePosee()) return;
    const etabImpose = btn?.dataset?.etab && etabById(btn.dataset.etab) ? btn.dataset.etab : null;
    const typeFixe = etabImpose && btn?.dataset?.typeFixe
      && typesCompteChoix().some(t => t.id === btn.dataset.type) ? btn.dataset.type : null;
    let etapes = typeFixe ? 1 : etabImpose ? 2 : 3;
    const e1 = typeFixe ? { type: typeFixe } : await askForm({
      titre: trad('Qu’ajoutes-tu ?'),
      sous: `${trad('Étape')} 1 ${trad('sur.etape', 'sur')} ${etapes}${etabImpose
        ? `, ${trad('chez')} ${etabById(etabImpose).nom}`
        : `, ${trad('cela détermine les placements possibles')}`}`,
      ok: 'Continuer',
      champs: [{ cle: 'type', label: 'Type', type: 'liste',
        options: [...typesCompteParRubrique(),
                  ['__nouveau', trad('+ Autre type…')]],
        /* Le defaut suit l'etablissement plutot que d'etre pose en dur : voir
           `typeParDefautChez`. Chez une societe qui ne porte que des parts, la
           fenetre proposait d'ouvrir un compte courant. */
        valeur: (btn?.dataset?.type && typesCompteChoix().some(t => t.id === btn.dataset.type))
          ? btn.dataset.type : typeParDefautChez(etabImpose) }],
    });
    if (!e1) return;
    if (e1.type === '__nouveau') {
      e1.type = await demanderTypePerso();
      if (!e1.type) return;
    }
    const t = typeCompte(e1.type);
    const mot = contenantDuType(t.id);

    /*       `sansEtab` porte deja cette propriete sur le type — les especes s'en
       servent — mais l'assistant ne la lisait pas : il n'avait jamais eu a le
       faire, les especes etant posees par le code et non par ce formulaire.
       L'etape saute, et le compte se cree sans contenant. */
    let etabId = etabImpose;
    let nomNouveauContenant = null;      // cree apres le dernier ecran, pas avant
    const nomContenant = () => etabById(etabId)?.nom || nomNouveauContenant || '';
    if (t.sansEtab) { etabId = null; etapes--; }
    /* Un bien detenu en direct cree toujours le sien.

       Le contenant ne disparait pas pour autant, contrairement au bien de
       valeur : c'est lui qui porte le credit, une dette vivant sur un
       etablissement. Il se cree simplement sans qu'on ait a le choisir, et
       `askText` en dessous demande son nom — un seul nom, pour le bien et pour
       son contenant.

       Rattacher un second bien au meme contenant reste possible, et c'est le
       bon chemin pour un parking sous l'appartement qu'il accompagne : le
       bouton « + Bien » de la fiche pose `etabImpose`, et cette branche ne
       s'execute pas. Le geste deliberat le fait, le parcours par defaut ne le
       propose plus. */
    else if (!etabId && estDetenuEnDirect(t)) etabId = '__nouveau';
    else if (!etabId) {
      /* Un contenant vide reste proposable, mais en dernier et jamais choisi
         d'avance.

         Il n'a plus de famille : `contenantDeLEtab` la derive des comptes
         rattaches, et sans compte elle retombe sur « banque ou courtier ». Un
         « Studio » dont le bien a ete supprime se proposait donc partout, et
         `proposables[0]` en faisait le choix par defaut : la fenetre qui demande
         chez quel assureur tenir un contrat s'ouvrait sur un studio. Le retirer
         d'office serait pire — on retaperait un nom qui existe, et deux
         etablissements homonymes vivraient cote a cote — mais rien n'oblige a
         le mettre en tete ni a le preselectionner. */
      const memeFamille = e => contenantDeLEtab(e.id).titre === mot.titre;
      const aDesComptes = e => COMPTES().some(c => c.etabId === e.id);
      /* La meme famille, puis un guichet compatible (une banque pour une
         assurance-vie), puis les vides : voir `etablissementsProposables`. */
      const proposables = etablissementsProposables(t.id).map(x => x.etab);
      if (!proposables.length) etabId = '__nouveau';
      else {
        const e2 = await askForm({
          titre: trad(mot.titre),
          sous: `${trad('Étape')} 2 ${trad('sur.etape', 'sur')} ${etapes}`,
          ok: 'Continuer',
          champs: [{ cle: 'etab', label: mot.question, type: 'liste', aide: mot.aide,
            options: [...proposables.map(e => [e.id,
              aDesComptes(e) ? e.nom : `${e.nom} (aucun compte)`]),
              ['__nouveau', `+ ${trad(mot.nouveau)}…`]],
            valeur: proposables.find(e => aDesComptes(e) && memeFamille(e))?.id || '__nouveau' }],
        });
        if (!e2) return;
        etabId = e2.etab;
      }
    }
    if (etabId === '__nouveau') {
      const nom = await askText(trad(mot.nouveau),
        `${trad('Étape')} 2 ${trad('sur.etape', 'sur')} ${etapes} · ${trad('Son nom, tel qu’il s’affichera partout.')}`, trad(mot.exemple));
      if (!nom) return;
      nomNouveauContenant = nom;
      etabId = null;
    }

    const bien = estUnBien(t);
    const classeDuBien = t.classes.find(c => c !== 'liquidites') || 'nonCote';
    /* Les champs d'un LOGEMENT — prix, frais et travaux, usage, quote-part,
       apport — ne vont qu'a l'immobilier detenu en direct. `estDetenuEnDirect`
       seul les posait aussi sur un bien de valeur : une montre se voyait
       demander si on l'habite, et ses trois couts ecrits au detail restaient
       ensuite hors de portee du seul champ que sa fiche propose. */
    const immoDirect = bien && estImmoEnDirect(t);
    /* UN PLACEMENT TENU PAR UN TIERS, qui EST le compte : une part de societe,
       un fonds non cote, un pret participatif. Il se cree par la meme fenetre que
       "Placement dans..." (`champsPlacement`), et non par celle d'un bien, qui
       demanderait un credit sur un bien, une date d'estimation pour un pret, et
       nommerait la ligne comme la plateforme : deux prets de la meme plateforme
       porteraient le meme nom. L'intitule se pre-remplit du nom de
       l'etablissement tant qu'il n'y porte aucun compte, vide ensuite. */
    const placementTiers = estActifTerminal(t) && !estDetenuEnDirect(t);
    const etabDejaPeuple = !!etabId && COMPTES().some(c => c.etabId === etabId);
    const champsTiers = !placementTiers ? [] : champsPlacement(classeDuBien, null, t.prete, t)
      .map(ch => ch.cle === 'libelle' ? { ...ch, valeur: etabDejaPeuple ? '' : nomContenant() }
        : ch.cle === 'valeur' ? { ...ch, requis: true } : ch);

    const e3 = await askForm({
      titre: placementTiers ? trad(t.prete ? 'Le prêt' : 'Le placement')
           : bien ? (estDetenuEnDirect(t) ? 'Valeur estimée'
                  : trad(t.classes.includes('nonCote') ? 'Valeur de la participation' : 'Valeur du bien'))
                  : t.sansCash ? trad(enContrat(t) ? 'Nommer le contrat' : 'Nommer le plan')
                  : `${BASES.liquidites.nom} ${trad('sur ce compte')}`,
      sous: (suite => etapes > 1
        ? `${trad('Étape')} ${etapes} ${trad('sur.etape', 'sur')} ${etapes}${suite ? `, ${suite}` : ''}`
        : majuscule(suite))(placementTiers ? trad('ce que tu y as mis, et ce que cela vaut aujourd’hui')
          : bien ? trad('la valeur actuelle se compare au coût d’acquisition')
          : t.sansCash ? trad('sa valeur viendra des supports que tu y ajouteras') : ''),
      ok: 'Créer',
      /* LES REGLES DE LA FENETRE, DANS L'ORDRE OU ELLES SE POSENT.

         « OUI » DOIT CREER UN CREDIT. La creation ne posait la dette que si le
         capital restant du etait positif : repondre « oui », laisser le champ
         vide et saisir une mensualite creait un bien SANS credit, en silence, et
         le patrimoine net naissait faux. Une reponse qui n'a pas de suite est
         pire qu'une question qu'on n'a pas posee.

         Un capital emprunte declare a ZERO alors qu'un capital restant est
         renseigne decrit un pret impossible. Le champ reste FACULTATIF — absent,
         il veut dire que la valeur n'est pas connue, et c'est une reponse
         legitime. C'est le zero explicite qui ne l'est pas.

         AUCUN MONTANT NEGATIF, et aucun n'est ramene a zero en douce : une
         valeur qu'on ne sait pas lire se refuse, elle ne se remplace pas. Le
         zero explicite, lui, reste une reponse partout ou il en est une — des
         frais nuls, des travaux nuls, un apport nul, un taux a zero.

         La quote-part passe par `partEstValide`, la meme porte que la fiche :
         150 % n'y devient jamais 100 %, ici pas davantage. */
      valide: v => {
        if (v.aCredit === 'oui' && !(num(v.credit) > 0))
          return { cle: 'credit', message: trad('Le capital restant dû doit être supérieur à 0 si tu déclares avoir encore un crédit.') };
        /* Les cinq champs du credit passent par la regle centrale, celle-la
           meme qu'appliquent l'ajout depuis un etablissement et l'edition : ici
           le capital restant du se nomme `credit`, d'ou la table des clefs. Une
           regle recopiee a trois endroits finit par diverger. */
        const faute = validerCreditSaisi(v, { montant: 'credit' });
        if (faute) return faute;
        for (const cle of ['valeur', 'prixAchat', 'fraisAcquisition', 'travauxInitiaux',
                           'apport', 'revient']) {
          if (estDeclare(v[cle]) && num(v[cle]) < 0)
            return { cle, message: trad('Un montant négatif ne peut pas être enregistré.') };
        }
        if (!partEstValide(v.part))
          return { cle: 'part', message: trad('La quote-part doit être comprise entre 0 et 100 %.') };
        return null;
      },
      champs: placementTiers ? champsTiers : bien ? [
        ...(t.sansEtab ? [{ cle: 'nom', label: trad('Nom du bien'), type: 'texte', requis: true,
          max: NOM_LIGNE_MAX, exemple: 'ex. Rolex Submariner',
          aide: trad('une montre, une voiture, un tableau : ce nom s’affichera partout') }] : []),
        /* La valeur est OBLIGATOIRE, et `vide()` compte un zero comme vide sur un
           champ nombre : un appartement a zero euro n'existe pas, et il entrait
           pourtant au patrimoine sans un mot, faussant le brut, le net et toutes
           les repartitions. Il n'y a rien a inventer pour la remplir — c'est la
           seule chose qu'on sache a coup sur en creant un bien. */
        ...(t.parts ? [{ cle: 'parts', label: trad('Nombre de parts'),
          type: 'nombre', exemple: '0',
          aide: trad('il se déduit du montant investi, et commande la valeur du jour') }] : []),
        ...(t.parts ? [{ cle: 'section_valeur', label: estValeurEstimee(t) ? 'Valeur estimée' : 'Valeur actuelle', type: 'section' }] : []),
        { cle: 'valeur', requis: true,
          label: estDetenuEnDirect(t) ? trad('Valeur estimée du bien entier ({dev})')
                                      : trad('Valeur actuelle ({dev})'),
          type: 'nombre', exemple: '0',
          aide: immoDirect
              ? trad('Sa valeur totale aujourd’hui. Si tu n’en détiens qu’une part, renseigne ta quote-part séparément.')
              : trad('ce que cela vaut aujourd’hui'),
          ...(t.parts ? { parPart: 'parts', parPartLabel: 'Prix de la part aujourd’hui ({dev})' } : {}) },
        ...(immoDirect ? [
        { cle: 'section_acq', label: 'Acquisition', type: 'section' },
        { cle: 'prixAchat', label: trad('Prix d’achat ({dev})'), type: 'nombre', exemple: '0',
          aide: trad('le prix du bien seul, hors frais et hors travaux') },
        { cle: 'fraisAcquisition', label: trad('Frais d’acquisition ({dev})'), type: 'nombre',
          exemple: '0', aide: trad('notaire, garantie, dossier, agence') },
        { cle: 'travauxInitiaux', label: trad('Travaux initiaux ({dev})'), type: 'nombre',
          exemple: '0', aide: trad('ceux du départ, pour le mettre en état') },
        ] : [
        ...(t.parts ? [{ cle: 'section_invest', label: 'Coût d’achat', type: 'section' }] : []),
        { cle: 'revient', label: trad('Montant investi ({dev})'), type: 'nombre', exemple: '0',
          aide: trad('prix d’acquisition, frais compris'),
          ...(t.parts ? { parPart: 'parts', parPartLabel: 'Prix d’achat de la part ({dev})',
            parPartSous: 'il donne le nombre de parts',
            parPartDeduitParts: true } : {}) },
        ]),
        { cle: 'ouvertLe', label: motDateCompte(t), type: 'date' },
        /* La date de l'estimation, distincte de celle de l'achat.

           C'est le seul champ de cette fenetre qui devient faux sans que
           personne y touche : une montre achetee 3 000 EUR en 2019 n'en vaut
           plus 3 000 aujourd'hui, et rien a l'ecran ne dit depuis quand le
           chiffre affiche n'a pas ete revu. Meme raison que `verifieLe` sur un
           credit, et meme regle : c'est le geste de quelqu'un qui a regarde,
           jamais une supposition. Pre-remplie au jour de la saisie, parce qu'on
           saisit ce qu'on vient d'estimer. */
        { cle: 'estimeLe', label: trad('Estimée le'), type: 'date', valeur: todayISO(),
          /* Elle ne promet plus de rappel : voir la note de `champsPlacement`.
             La meme phrase vivait ici, et une promesse fausse recopiee est
             deux fois fausse. */
          aide: trad('le jour où tu as établi ce chiffre') },
        /* Au bien DETENU EN DIRECT, et a lui seul : la classe `immobilier`
           couvre aussi la SCPI, a qui l'on demandait donc si elle etait une
           residence principale. Le drapeau `direct` du type tranche.

           Et sans choix vide : pose plus tard dans une fiche, l'usage restait
           vide chez presque tout le monde, et la fiche d'une residence
           principale continuait de parler rendement. C'est le seul moment ou on
           le sait a coup sur. */
        /* L'option vide N'EST PAS une facilite : sans elle, un select rend son
           premier choix des l'ouverture, et `USAGES_BIEN` commence par « Mis en
           location ». Un bien cree sans jamais toucher au champ naissait donc
           locatif, sans qu'aucune decision ait ete prise — exactement ce que
           `requis` devait empecher. Avec une valeur vide de depart, `requis`
           mord enfin : `vide()` rend vrai sur la chaine vide. */
        ...(immoDirect ? [{ cle: 'usageBien', label: trad('Usage'),
          type: 'liste', requis: true, valeur: '',
          options: [['', trad('Choisir…')], ...USAGES_BIEN],
          aide: trad('il décide de ce que la fiche te montre : un rendement, ou un coût') }] : []),
        ...(immoDirect ? [{ cle: 'part', label: trad('Ta part (%)'),
          type: 'nombre', exemple: '100',
          aide: trad('À remplir seulement si tu détiens ce bien à plusieurs. La valeur saisie reste celle du bien entier ; ton patrimoine ne compte que ta part.') }] : []),
        ...(t.sansEtab ? [] : (() => {
        /* La question d'abord, les champs ensuite — et seulement si la reponse
           est oui. Un bien paye comptant traversait six champs de pret vides
           avant d'arriver au bout, et rien ne disait qu'on pouvait les sauter.
           `montreSi` les fait disparaitre, et `valeurs()` ne lit pas un champ
           masque : repondre « oui », saisir, puis revenir a « non » ne cree
           donc aucun credit. */
        const avecCredit = v => v.aCredit === 'oui';
        return [
        { cle: 'section_fin', label: 'Financement', type: 'section' },
        { cle: 'aCredit', label: trad('As-tu encore un crédit sur ce bien ?'), type: 'liste',
          valeur: 'non', options: [['non', trad('Non')], ['oui', trad('Oui')]] },
        { cle: 'credit', label: trad('Capital restant dû ({dev})'), type: 'nombre', exemple: '0',
          montreSi: avecCredit,
          aide: trad('Ce que tu dois encore personnellement aujourd’hui. Cette dette se déduit de ton patrimoine net.') },
        { cle: 'initial', label: trad('Capital emprunté au départ ({dev})'), type: 'nombre',
          exemple: '0', montreSi: avecCredit,
          aide: trad('Le capital emprunté à ta charge au départ, facultatif. Il permet de suivre ce que tu as déjà remboursé.') },
        { cle: 'preteur', label: 'Prêteur', type: 'texte', exemple: 'ex. Ma banque',
          suggestions: valeursConnues('preteur'), montreSi: avecCredit,
          aide: trad('la banque qui prête, si ce n’est pas toi') },
        { cle: 'mensualite', label: trad('Mensualité facturée ({dev})'), type: 'nombre', exemple: '0',
          montreSi: avecCredit,
          aide: trad('Assurance incluse. Elle sera ajoutée aux charges fixes ; tu pourras ensuite indiquer la part payée par quelqu’un d’autre.') },
        { cle: 'taux', label: trad('Taux annuel (%)'), type: 'nombre', exemple: '0',
          montreSi: avecCredit,
          aide: trad('facultatif, il sert à suivre le capital qui reste') },
        { cle: 'tauxAssurance', label: trad('Taux d’assurance (%)'), type: 'nombre', exemple: '0',
          montreSi: avecCredit,
          aide: trad('facultatif, environ 0,3 % du capital emprunté : elle sort de la mensualité sans rembourser') },
        champPartCredit('', x => avecCredit(x) && estDeclare(x.part) && num(x.part) < 100),
        { cle: 'charge', label: trad('Ajouter une charge mensuelle fixe'), type: 'case', valeur: true,
          montreSi: avecCredit,
          aide: trad('seulement si tu renseignes une mensualité : elle entrera dans ton budget sous ce nom') },
        ...(!immoDirect ? [] : [
        { cle: 'apport', label: trad('Apport initial ({dev})'), type: 'nombre', exemple: '0',
          aide: trad('facultatif, ce que tu as sorti de ta poche le jour de l’achat') },
        ]),
        ];
        })()),
      ] : [
        { cle: 'libelle', label: trad(!t.sansCash ? 'Nom du compte' : enContrat(t) ? 'Nom du contrat' : 'Nom du plan'), type: 'texte',
          valeur: `${t.label} ${nomContenant()}`.trim(),
          aide: trad(!t.sansCash ? 'c’est lui qui distingue deux comptes du même type'
                   : enContrat(t) ? 'c’est lui qui distingue deux contrats du même type'
                   : 'c’est lui qui distingue deux plans du même type') },
        ...(t.sansCash ? [] : [
        { cle: 'montant', label: trad('Montant ({dev})'), type: 'nombre', exemple: '0',
          aide: trad('Un compte joint se saisit comme tu le suis : ta part si chacun tient son tableau de bord, le solde entier pour suivre le foyer.') },
        { cle: 'usage', label: trad('À quoi sert cet argent ?'), type: 'liste',
          options: AFFECTATIONS, valeur: t.defaut,
          aide: trad('pré-rempli selon le type de compte, modifiable librement') },
        { cle: 'scinder', label: trad('Scinder : déclarer un second usage'), type: 'case',
          aide: trad('deux usages sur le même compte, sans le dupliquer') },
        ]),
        ...(t.dateSensible ? [{ cle: 'ouvertLe', label: trad('Date d’ouverture'), type: 'date',
          aide: trad('elle donne l’ancienneté, que la fiche affiche : cinq ans pour un PEA, huit pour une assurance-vie') }]
          : t.echeanceUnique ? [
          { cle: 'ouvertLe', label: trad('Date d’ouverture'), type: 'date', aide: trad('facultatif') },
          { cle: 'debloqueLe', label: trad('Déblocage prévu'), type: 'date',
            aide: trad('facultatif : la date à laquelle tu prévois de récupérer cet argent, ta retraite en général') }] : []),
      ],
    });
    if (!e3) return;

    if (nomNouveauContenant) {
      const slug = nomNouveauContenant.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'etab';
      let id = 'e_' + slug, n = 2;
      while (etabById(id)) id = 'e_' + slug + (n++);
      Store.state.etabs.push({ id, nom: nomNouveauContenant, notes: '', dettes: [] });
      etabId = id;
    }

    let id = 'c_' + Date.now().toString(36), n = 2;
    while (compteById(id)) id = 'c_' + Date.now().toString(36) + (n++);

    const cash = [], lignes = [];
    const apportDit = estDeclare(e3.apport) ? num(e3.apport) : null;
    if (placementTiers) {
      lignes.push(litPlacement(e3, { id: 'l' + Date.now().toString(36), classe: classeDuBien }, t));
    } else if (bien) {
      lignes.push({ id: 'l' + Date.now().toString(36), classe: classeDuBien,
        libelle: String(e3.nom || '').trim() || nomContenant() || t.label,
        valeur: num(e3.valeur),
        /* Vide reste vide : `estDeclare` decide, pas la verite JS. Un zero tape
           est une declaration — « il n'y a pas eu de travaux » — et un champ
           traverse sans rien ecrire ne doit pas devenir un zero. */
        ...(estDeclare(e3.prixAchat) ? { prixAchat: num(e3.prixAchat) } : {}),
        ...(estDeclare(e3.fraisAcquisition)
          ? { fraisAcquisition: num(e3.fraisAcquisition) } : {}),
        ...(estDeclare(e3.travauxInitiaux)
          ? { travauxInitiaux: num(e3.travauxInitiaux) } : {}),
        ...(estDeclare(e3.revient) ? { prixDeRevient: num(e3.revient) } : {}),
        ...(estDeclare(e3.parts) ? { parts: num(e3.parts) } : {}),
        dateAcquisition: e3.ouvertLe || '', estimeLe: e3.estimeLe || todayISO(),
        ...(e3.usageBien ? { usage: e3.usageBien } : {}),
        /* Vide reste vide : sans quote-part declaree, la ligne n'en porte pas,
           et `partDetention` rend le tout. Un zero declare s'ecrit, lui — c'est
           la reponse juste pour un bien qu'on ne detient plus mais qu'on garde
           en memoire. */
        ...(estDeclare(e3.part) ? { part: num(e3.part) } : {}) });
      if (num(e3.credit)) {
        const et = etabById(etabId);
        et.dettes = et.dettes || [];
        et.dettes.push({ id: 'd' + Date.now().toString(36),
          libelle: `${trad('Crédit')} ${nomContenant()}`.trim(),
          montant: num(e3.credit), preteur: e3.preteur || '', note: '',
          /* Le capital emprunte au depart survit a la creation quand il est
             declare, et reste absent sinon. Le `&& > 0` qui trainait ici rangeait
             un ZERO DECLARE parmi les inconnus : c'est la faute que le reste du
             code a deja corrigee partout ailleurs, et elle survivait sur ce seul
             chemin. Un zero avec une dette qui reste est refuse plus haut, a la
             validation — pas efface en silence. */
          initial: estDeclare(e3.initial) ? num(e3.initial) : null,
          mensualite: estDeclare(e3.mensualite) ? num(e3.mensualite) : null,
          /* Un taux declare a zero survit a la creation : `|| null` le rangeait
             aussitot parmi les taux inconnus. */
          taux: estDeclare(e3.taux) ? num(e3.taux) : null,
          tauxAssurance: estDeclare(e3.tauxAssurance) ? num(e3.tauxAssurance) : null,
          part: lirePartCredit(e3.partCredit),
          bienId: id,
          verifieLe: todayISO() });
        /* La charge fixe dans le meme geste : c'est le seul moment ou l'on a la
           mensualite en tete. `creerChargeDuCredit()` ne fait rien sans elle. */
        if (e3.charge) creerChargeDuCredit(et.dettes[et.dettes.length - 1]);
      }
    } else if (t.sansCash) {
      /* Un contrat nait sans part de cash. L'etape 3 ne pose plus les trois
         champs pour ces types-la, mais la creation les lisait quand meme : elle
         ecrivait une part a zero portant une affectation `undefined`. La carte
         de tresorerie, qui ne se masque que lorsqu'elle est vide, reapparaissait
         donc aussitot avec son menu — « Cash disponible » sur une assurance-vie,
         exactement ce que `sansCash` devait retirer. Ne rien ecrire est la seule
         facon de ne rien montrer. */
    } else {
      const saisi = m => (num(m) ? { saisiLe: todayISO() } : {});
      cash.push({ montant: num(e3.montant), affectation: e3.usage, ...saisi(e3.montant) });
      if (e3.scinder) {
        const e4 = await askForm({
          titre: trad('Seconde part'), sous: trad('Le même compte, un autre usage'),
          ok: 'Ajouter cette part',
          champs: [
            { cle: 'montant', label: trad('Montant ({dev})'), type: 'nombre', exemple: '0' },
            { cle: 'usage', label: trad('À quoi sert cet argent ?'), type: 'liste',
              options: AFFECTATIONS.filter(([v]) => v !== e3.usage),
              valeur: AFFECTATIONS.find(([v]) => v !== e3.usage)[0] },
          ],
        });
        if (e4) cash.push({ montant: num(e4.montant), affectation: e4.usage, ...saisi(e4.montant) });
      }
    }

    Store.state.comptes.push({
      id, etabId, type: t.id, statut: 'ouvert',
      libelle: String(e3.libelle || e3.nom || '').trim(),
      ouvertLe: (placementTiers ? e3.dateAcquisition : e3.ouvertLe) || '', numero: '', notes: '',
      ...(e3.debloqueLe ? { debloqueLe: e3.debloqueLe } : {}),
      ...(apportDit === null ? {} : { apport: apportDit }),
      cash, lignes,
    });
    refreshAccounts(); Store.save(); render();
    toast([t.label, nomContenant() || String(e3.nom || '').trim()].filter(Boolean).join(' · ')
      + (t.melange ? trad(', ajoute ses supports sur sa fiche')
         : t.titres ? trad(', les placements s’ajoutent dans Marchés')
                  : bien ? (num(e3.credit)
                      ? ` · ${trad('{v} moins {c} de crédit')
                          .replace('{v}', fmtEUR0(num(e3.valeur)))
                          .replace('{c}', fmtEUR0(num(e3.credit)))}`
                      : ` · ${fmtEUR0(num(e3.valeur))}`) : ''));
    if (bien && e3.usageBien === 'principale') await proposerTransitionLoyer();
  },

  'fiche-compte'(btn) {
    const swipe = btn.closest?.('.cpt-swipe');
    if (swipe?.classList.contains('ouvert')) {
      swipe.classList.remove('ouvert');
      swipe.querySelector('.cpt-ligne').style.transform = '';
      return;
    }
    location.hash = '#/compte/' + encodeURIComponent(btn.dataset.id);
  },
  'fiche-etab'(btn) { location.hash = '#/etab/' + encodeURIComponent(btn.dataset.id); },

  async 'resoudre-titres-archives'(btn) {
    const x = archivesAvecTitres().find(a => a.compte.id === btn.dataset.id);
    if (!x) return;
    const nom = nomCompteV2(x.compte);
    const dests = destinationsLignes(x.compte.id);
    const v = await askForm({
      titre: `${guill(nom)} : ${trad('des titres sur un compte archivé')}`,
      sous: trad(x.lignes.length > 1
        ? '{k} lignes, {v}, sont rattachées à ce compte archivé : Marchés les compte, ton patrimoine non. Rien ne change sans ton choix.'
        : '{k} ligne, {v}, est rattachée à ce compte archivé : Marchés la compte, ton patrimoine non. Rien ne change sans ton choix.')
        .replace('{k}', x.lignes.length).replace('{v}', fmtEUR0(x.valeur)),
      ok: 'Continuer',
      champs: [
        { cle: 'geste', label: trad('Que s’est-il passé ?'), type: 'liste', valeur: dests.length ? 'deplacer' : 'vendre',
          options: [
            ...(dests.length ? [['deplacer', 'Elles sont sur un autre compte : les y déplacer']] : []),
            ['vendre', 'Elles ont été vendues : enregistrer chaque vente'],
            ['restaurer', 'Le compte est toujours ouvert : le restaurer'],
          ] },
        ...(dests.length ? [{ cle: 'vers', label: trad('Vers quel compte ?'), type: 'liste', valeur: dests[0].id,
          options: dests.map(d => [d.id, nomCompteV2(d)]), montreSi: y => y.geste === 'deplacer' }] : []),
      ],
    });
    if (!v) return;
    if (v.geste === 'deplacer') {
      const r = deplacerLignesArchivees(x.compte.id, v.vers);
      if (!r.ok) { toast(trad('Le déplacement n’a pas pu se faire : rien n’a été modifié.')); return; }
      Store.save(); render();
      toast(trad('{k} lignes déplacées vers {d} · patrimoine net {e}')
        .replace('{k}', r.lignes).replace('{d}', guill(nomCompteV2(compteById(v.vers))))
        .replace('{e}', fmtSigned(r.valeur)));
    } else if (v.geste === 'vendre') {
      posRole = 'tous'; posCompte = x.compte.id; location.hash = '#/positions';
      toast(trad('Ouvre chaque ligne et enregistre sa vente : son produit arrive sur le compte que tu choisis.'));
    } else if (v.geste === 'restaurer') {
      await ACTIONS['restaurer-compte']({ dataset: { id: x.compte.id } });
    }
  },
  async 'archiver-compte'(btn) {
    const c = compteById(btn.dataset.id);
    if (c && typeCompte(c.type).interne) {
      await askConfirm(trad('Les espèces ne s’archivent pas') + '\n'
        + trad('Ce compte existe pour tout le monde, sans établissement. S’il n’y a '
        + 'plus de billets, mets son montant à 0 : il sort alors de tous les '
        + 'totaux, et les relevés passés restent lisibles.'),
        { ok: 'Compris', danger: false });
      return;
    }
    const imp = c && impactArchivage(c.id);
    if (!imp) return;
    const nom = nomCompteV2(c);
    if (imp.lignesTitres) {
      const voir = await askConfirm(`${trad('Archiver')} ${guill(nom)} ?\n`
        + trad(imp.lignesTitres > 1 ? 'Ce compte porte encore {n} lignes de titres, pour {v}.'
                                    : 'Ce compte porte encore {n} ligne de titres, pour {v}.')
          .replace('{n}', imp.lignesTitres).replace('{v}', fmtEUR0(imp.valeurTitres)) + '\n\n'
        + trad('Archivé, il sortirait de ton patrimoine, mais ses lignes resteraient comptées dans Marchés. Déplace-les vers le compte qui les reçoit, ou enregistre leur vente, puis archive-le.'),
        { danger: false, ok: 'Voir ses lignes', refus: 'Fermer' });
      if (voir) { posRole = 'tous'; posCompte = c.id; location.hash = '#/positions'; }
      return;
    }
    const vide = Math.abs(imp.valeur) < 0.005;
    const impact = vide ? trad('Ce compte est vide : tes totaux ne changent pas.')
      : trad('Ton patrimoine net passerait de {a} à {b} ({e}).')
          .replace('{a}', fmtEUR0(imp.netAvant)).replace('{b}', fmtEUR0(imp.netApres))
          .replace('{e}', fmtSigned(imp.ecartNet))
        + (imp.creditRestant > 0.005 ? ' ' + trad('Son crédit, {c} restant dû, reste compté dans tes dettes.')
            .replace('{c}', fmtEUR0(imp.creditRestant)) : '');
    const t = typeCompte(c.type) || {};
    const solde = soldeTransferable(c);
    const dests = solde != null ? destinationsTransfert(c.id) : [];
    const transferable = dests.length > 0;
    const quoiFaire = vide || transferable ? ''
      : estBien(t) ? trad('Archiver ne vend pas ce bien : s’il a été vendu, mets à jour le solde du compte qui a reçu le prix, puis archive-le.')
        + (imp.creditRestant > 0.005 ? ' ' + trad('Solde son crédit dans sa fenêtre quand il est remboursé.') : '')
      : solde == null ? trad('Archiver ne cède pas ce placement : s’il a été vendu ou remboursé, enregistre-le avec « Céder » sur sa fiche, qui crédite le prix sur le compte de ton choix.')
      : trad('Aucun autre compte suivi ne peut recevoir ce solde : ajoute celui qui l’a reçu pour l’y transférer.');
    const motifs = MOTIFS_ARCHIVE.filter(([k]) => k !== 'transfert' || transferable);
    const effet = x => {
      const m = num(x.montant);
      if (!(m > 0)) return trad('Indique le montant transféré.');
      if (m > solde + 0.005) return trad('Plus que le solde : ce montant créerait de l’argent.');
      if (Math.abs(m - solde) < 0.005) return trad('Tout le solde passe sur l’autre compte : ton patrimoine net ne change pas.');
      return trad('{r} non transférés sortiront de ton patrimoine suivi.').replace('{r}', fmtEUR0(solde - m));
    };
    const v = await askForm({
      titre: `Archiver ${guill(nom)} ?`,
      sous: `${impact}${quoiFaire ? ` ${quoiFaire}` : ''} ${trad('Ses relevés passés restent dans l’historique. Restaurable à tout moment.')}`,
      ok: 'Archiver',
      champs: [
        ...(vide ? [] : [{ cle: 'motif', label: trad('Que devient cet argent ?'), type: 'liste', valeur: '',
          options: [['', 'à préciser'], ...motifs],
          aide: transferable
            ? trad('Un transfert déplace ce solde vers un autre compte suivi, dans ce même geste : ton patrimoine ne change pas. Une sortie le fait baisser d’autant. Une correction retire un compte qui n’aurait pas dû exister : ses relevés passés gardent leurs montants, à corriger dans l’historique s’ils étaient faux.')
            : trad('Une sortie fait baisser ton patrimoine d’autant. Une correction retire un compte qui n’aurait pas dû exister : ses relevés passés gardent leurs montants, à corriger dans l’historique s’ils étaient faux.') }]),
        ...(!transferable ? [] : [
          { cle: 'vers', label: trad('Vers quel compte ?'), type: 'liste',
            ...(({ options, valeur }) => ({ options, valeur }))(listeDeParts(dests, dests[0].id, { credit: true })),
            montreSi: x => x.motif === 'transfert' },
          { cle: 'montant', label: trad('Montant transféré ({dev})'), type: 'nombre', valeur: solde,
            aide: trad('tout le solde, sauf si une partie est partie ailleurs'),
            montreSi: x => x.motif === 'transfert' },
          { cle: 'effet', label: trad('Effet'), calcul: effet, montreSi: x => x.motif === 'transfert' },
        ]),
        { cle: 'clotureLe', label: trad('Date de clôture'), type: 'date', valeur: todayISO(),
          aide: trad('facultative. C’est elle qui situe le compte dans le temps : une ')
              + 'vente passée sur un PEA clôturé se relit autrement quand on sait '
              + 'quand il a fermé' },
      ],
      valide: x => {
        if (!vide && !x.motif) return { cle: 'motif', message: trad('Dis ce que devient cet argent : un transfert, une sortie et une correction ne racontent pas la même chose.') };
        if (x.motif !== 'transfert') return null;
        const vers = lirePart(x.vers);
        if (!vers || !dests.some(d => d.id === vers.compteId)) return { cle: 'vers', message: trad('Choisis le compte qui reçoit l’argent.') };
        const m = num(x.montant);
        if (!(m > 0.005) || m > solde + 0.005) return { cle: 'montant', message: trad('Le montant transféré doit être positif et ne pas dépasser le solde.') };
        return null;
      },
    });
    if (!v) return;
    if (v.motif === 'transfert') {
      /* Tout ou rien : `archiverParTransfert` travaille sur une copie de l'etat
         et ne la garde que si le net se retrouve au centime. */
      const vers = lirePart(v.vers);
      const r = archiverParTransfert({ source: c.id, destination: vers.compteId, partie: vers.partie,
                                       montant: v.montant, clotureLe: v.clotureLe });
      if (!r.ok) { toast(trad('Le transfert n’a pas pu se faire : rien n’a été modifié.')); return; }
      Store.save(); render();
      const dest = compteById(vers.compteId);
      toast(`${guill(nom)} ${trad('archivé')} · ${trad('{v} transférés vers {d}').replace('{v}', fmtEUR0(r.montant))
        .replace('{d}', guill(nomCompteV2(dest)))} · ${Math.abs(r.ecartNet) < 0.005
        ? trad('patrimoine net inchangé') : `${trad('patrimoine net')} ${fmtSigned(r.ecartNet)}`}`);
      return;
    }
    c.statut = 'archive';
    if (v.clotureLe) c.clotureLe = v.clotureLe; else delete c.clotureLe;
    if (v.motif) c.archiveMotif = v.motif; else delete c.archiveMotif;
    refreshAccounts(); Store.save(); render();
    const suite = v.motif === 'sortie' ? `${trad('patrimoine net')} ${fmtSigned(imp.ecartNet)}`
      : v.motif === 'correction' ? trad('ses relevés passés gardent leurs montants') : '';
    toast(`${guill(nom)} ${trad('archivé')}${v.clotureLe ? ` ${trad('au')} ${fmtDate(v.clotureLe)}` : ''}${
      suite ? ` · ${suite}` : ''}`);
  },
  async 'restaurer-compte'(btn) {
    const c = compteById(btn.dataset.id);
    if (!c) return;
    const v = valeurCompte(c);
    if (!await askConfirm(`${trad('Restaurer')} ${guill(nomCompteV2(c))} ?\n`
      + `${trad('Il revient dans tous les totaux de ton patrimoine')}${
          Math.abs(v) > 0.005 ? `, ${trad('pour')} ${fmtEUR(v)}` : ''}.\n\n`
      + (c.clotureLe
        ? trad("Sa date de clôture, le {d}, sera retirée : un compte rouvert n'est pas clôturé.")
            .replace('{d}', fmtDate(c.clotureLe))
        : trad("Réversible : tu peux l'archiver de nouveau.")),
      { danger: false, ok: 'Restaurer' })) return;
    const avait = c.clotureLe;
    c.statut = 'ouvert';
    delete c.clotureLe;
    delete c.archiveMotif;
    delete c.archiveVers;
    refreshAccounts(); Store.save(); render();
    toast(`${guill(nomCompteV2(c))} ${trad('restauré')}${avait ? trad(', sa date de clôture est retirée') : ''}`);
  },
  'maj-solde'() {
    const champ = $('[data-anchor="solde"] [data-anchor-focus]');
    if (!champ) return;
    const doux = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    champ.scrollIntoView({ block: 'center', behavior: doux ? 'smooth' : 'auto' });
    champ.focus({ preventScroll: true });
    if (champ.select) champ.select();
  },
  async 'annuler-fiche'(btn) {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    const retour = () => ACTIONS.goto({ dataset: { view: btn?.dataset?.view || 'accounts', anchor: '' } });
    if (!ficheModifiee()) { retourHaptique(); ficheAvant = null; retour(); return; }
    const ok = await askConfirm(
      trad('Annuler tes modifications ?') + '\n'
      + trad('Cette fiche revient à son dernier état enregistré, crédit et lignes compris. '
      + 'Ce que tu y as saisi depuis sera perdu.'),
      { ok: 'Annuler les modifications', refus: 'Continuer à modifier' });
    if (!ok) return;
    retablirFiche();
    ficheAvant = null;
    refreshAccounts(); Store.save(); render();
    toast(trad('Modifications annulées'));
    retour();
  },

  async 'enregistrer-fiche'(btn) {
    /* Le blur d'abord : sur iOS, un champ encore actif peut n'avoir pas emis son
       dernier `input`, et l'ecriture se ferait sans lui. Et il fait aussi passer
       la derniere frappe par `applyField`, donc par la garde ci-dessous. */
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    /* UN CHAMP INVALIDE BLOQUE L'ENREGISTREMENT.

       `applyField` refusait deja d'ecrire une quote-part hors bornes, mais
       refuser l'ecriture ne suffisait pas : « Enregistrer » sauvegardait le
       reste, annonçait « Enregistre » et rendait la main. Le detenteur repartait
       en croyant avoir saisi 150 % alors que l'ancienne valeur etait restee dans
       les donnees — le refus n'existait que pour le calcul, pas pour lui.

       Le geste se refuse donc la ou il se fait : rien n'est enregistre, la fiche
       ne bouge pas, et le champ fautif reçoit le curseur. « Annuler » reste
       ouvert : on n'oblige personne a corriger pour abandonner. */
    const invalide = $('[data-invalide="1"]');
    if (invalide) {
      invalide.focus();
      invalide.select?.();
      toast(messageChampInvalide(invalide));
      return;
    }
    /* LA TRANSITION SUIT LE GESTE, pas le rendu. La fiche porte un select qui
       ecrit l'usage par `data-path` : changer un bien en residence principale
       par ce chemin-la ne posait donc pas la question de l'ancien loyer, alors
       que le petit atelier « Choisir l'usage » la posait. Deux chemins pour un
       meme fait metier, et un seul des deux tenait la promesse.

       L'etat d'AVANT vient de l'instantane de la fiche, pris au premier rendu de
       la route : c'est lui qui dit si l'usage a change, et il evite de reposer
       la question a qui reenregistre le meme choix. Rien n'est branche sur
       `applyField` ni sur un ecouteur de champ — un rendu, une ouverture de
       fiche, une valeur corrigee ne declenchent rien. */
    const devientPrincipale = (() => {
      if (!ficheAvant || !String(ficheAvant.cle).startsWith('compte:')) return false;
      const c = objetDeFiche(ficheAvant.cle);
      if (!c || !estBienEnDirect(c) || usageBien(c) !== 'principale') return false;
      const avant = compteDeLInstantane(ficheAvant, c.id);
      return !!avant && usageBien(avant) !== 'principale';
    })();
    /* LE BOUTON DU FORMULAIRE D'UN MONTANT LE DATE DU JOUR, meme inchange :
       appuyer sur « Enregistrer » dans la carte du solde ou dans la carte
       « Mettre a jour » d'un bien dit « ce chiffre est bon aujourd'hui ». Les
       autres barres (informations d'un compte, notes d'un etablissement) ne
       portent pas `data-dater` et ne datent rien, pas plus qu'« Annuler ». Une
       date posee a la main pendant la visite gagne : confirmerBien la compare
       a l'instantane. Rien d'autre ne bouge, ni montant ni releve. */
    const dater = btn && btn.dataset ? btn.dataset.dater : '';
    if (dater) {
      const r = routeParam();
      const compte = r && r.genre === 'compte' ? compteById(r.id) : null;
      if (compte && dater === 'solde') confirmerSolde(compte);
      if (compte && dater === 'bien') confirmerBien(compte, ficheAvant);
    }
    retourHaptique();
    Store.save();
    toast(trad('Enregistré ✓'));
    /* L'instantane se reprend au lieu de disparaitre : « Annuler » ne peut pas
       defaire ce qui vient d'etre enregistre, sinon il promettrait un point de
       retour qui n'existe plus. Vide, il se repose au rendu suivant sur l'etat
       du moment — `memoriserFiche()` ne le reprend que dans ce cas.
       La position dans la page est gardee : la fiche est longue, et remonter en
       haut apres un enregistrement ferait perdre la ligne qu'on relisait. */
    ficheAvant = null;
    const y = window.scrollY;
    refreshAccounts(); render();
    window.scrollTo(0, y);
    if (devientPrincipale) await proposerTransitionLoyer();
  },

  async 'choisir-usage'(btn) {
    const c = compteById(btn.dataset.id);
    if (!c) return;
    const u = usageEffectifBien(c);
    if (u.action === 'lots') return;
    const v = await askForm({
      titre: trad('Usage du bien'),
      sous: nomCompteV2(c),
      ok: 'Enregistrer',
      /* Rien de preselectionne quand rien n'est connu : le choix doit etre un
         choix. `u.usage` vaut deja '' sur un usage inconnu, et porte la
         deduction sur un legacy locatif — la, proposer est legitime, c'est ce
         que l'ecran affiche deja. */
      champs: [{ cle: 'usage', label: trad('Usage'), type: 'liste', requis: true,
        options: [['', trad('Choisir…')], ...USAGES_BIEN], valeur: u.usage || '',
        aide: trad('il décide de ce que la fiche te montre : un rendement, ou un coût') }],
    });
    if (!v) return;
    for (const l of (c.lignes || []))
      if ((l.classe || 'immobilier') === 'immobilier') l.usage = v.usage;
    Store.save(); render();
    toast(`${nomCompteV2(c)} · ${trad(USAGE_BIEN_LABEL[v.usage])}`);
    if (v.usage === 'principale' && u.usage !== 'principale')
      await proposerTransitionLoyer();
  },

  async 'supprimer-compte'(btn) {
    const c = compteById(btn.dataset.id);
    if (!c) return;
    if (typeCompte(c.type).interne) {
      await askConfirm(trad('Les espèces ne se suppriment pas') + '\n'
        + trad('Ce compte existe pour tout le monde, sans établissement. S’il n’y a '
        + 'plus de billets, mets son montant à 0 : il sort alors de tous les '
        + 'totaux, et les relevés passés restent lisibles.'),
        { ok: 'Compris', danger: false });
      return;
    }
    const titres = Store.state.positions.filter(p => p.account === c.id).length;
    if (titres) {
      await askConfirm(`${trad('Impossible de supprimer')} ${guill(nomCompteV2(c))}\n`
        + trad(titres > 1 ? '{n} placements de marché y sont rattachés.'
                          : '{n} placement de marché y est rattaché.').replace('{n}', titres)
        + ' ' + trad("Déplace-les d'abord vers un autre compte dans Marchés."),
        { ok: 'Compris', danger: false });
      return;
    }
    const v = valeurCompte(c);
    const mois = Store.state.monthly.filter(r => r.v && r.v[c.id] != null).length;
    const etab = etabById(c.etabId);
    const dernierDeSonEtab = etab
      && COMPTES().filter(x => x.etabId === etab.id && x.id !== c.id).length === 0;
    const credits = dernierDeSonEtab ? (etab.dettes || []) : [];
    const duCredit = credits.reduce((s, d) => s + num(d.montant), 0);
    /* Les credits que CE bien porte et qui lui survivraient : le contenant
       reste, donc ils ne partent pas avec lui, et leur `bienId` designerait un
       compte disparu. Une reference morte ne se voit nulle part et fausse toutes
       les lectures a venir. Le cas du dernier compte est deja traite au-dessus :
       tout part ensemble, et il n'y a rien a demander. */
    const orphelins = dernierDeSonEtab ? [] : creditsDuBien(c);
    let sort = null;
    if (orphelins.length) {
      const restants = (Store.state.comptes || [])
        .filter(x => x.etabId === c.etabId && x.id !== c.id)
        .map(x => [x.id, `${trad('Rattacher à')} ${nomCompteV2(x)}`]);
      const r = await askForm({
        titre: trad(orphelins.length > 1 ? '{n} crédits financent ce bien'
                                         : 'Un crédit finance ce bien')
          .replace('{n}', orphelins.length),
        sous: `${fmtEUR0(orphelins.reduce((s, d) => s + num(d.montant), 0))} ${
          trad('de capital restant dû')}`,
        ok: 'Continuer',
        champs: [{ cle: 'sort', label: trad('Que devient ce financement ?'), type: 'liste',
          options: [['supprimer', trad('Le supprimer avec le bien')], ...restants],
          aide: trad('un crédit ne peut pas rester rattaché à un bien qui n’existe plus') }],
      });
      if (!r) return;
      sort = r.sort;
    }
    const delies = B().income.filter(r => r.bienId === c.id).length
                 + B().fixedCharges.filter(x => x.bienId === c.id).length;
    if (!await askConfirm(`${trad('Supprimer')} ${guill(nomCompteV2(c))} ?\n\n`
      + (v ? trad('Sa valeur de {v} sortira du patrimoine.').replace('{v}', fmtEUR(v)) + '\n' : '')
      + (duCredit ? trad('Le crédit qui le finance, {c} de capital restant dû, sera supprimé en '
                       + 'même temps : il ne peut pas rester seul.').replace('{c}', fmtEUR(duCredit)) + '\n' : '')
      + (mois ? trad(mois > 1 ? 'Ses montants restent lisibles dans {n} relevés passés.'
                              : 'Ses montants restent lisibles dans {n} relevé passé.')
                  .replace('{n}', mois) + '\n' : '')
      + (orphelins.length ? (sort === 'supprimer'
            ? trad('Son financement sera supprimé.')
            : trad('Son financement sera rattaché à un autre bien.')) + '\n' : '')
      + (delies ? trad(delies > 1 ? '{n} lignes de budget resteront, sans rattachement.'
                                  : '{n} ligne de budget restera, sans rattachement.')
                    .replace('{n}', delies) + '\n' : '')
      + (dernierDeSonEtab ? `${guill(etab.nom)} ${trad("disparaîtra avec lui : c'était son dernier compte.")}\n` : '')
      + `\n${trad('Réversible avec Ctrl+Z.')}`, { ok: 'Supprimer', danger: true })) return;
    if (credits.length) {
      /* Le dernier compte emmene tout : les charges qui remboursaient ces
         credits ne peuvent pas garder un `creditId` vers une dette effacee. */
      for (const d of credits) delierChargeDuCredit(d.id);
      etab.dettes = [];
    }
    if (orphelins.length) {
      if (sort === 'supprimer') {
        for (const d of orphelins) delierChargeDuCredit(d.id);
        etab.dettes = (etab.dettes || []).filter(d => !orphelins.includes(d));
      } else for (const d of orphelins) rattacherCredit(d, sort);
    }
    delierDuBien(c.id);
    if (!Store.state.accounts.some(a => a.id === c.id)) {
      Store.state.accounts.push({ id: c.id, label: nomCompteV2(c), short: c.court || '',
        broker: nomEtabDe(c), type: c.type, group: typeCompte(c.type).groupe, legacy: true });
    }
    Store.state.comptes = Store.state.comptes.filter(x => x.id !== c.id);
    /* Le contenant part avec son dernier compte, comme ses credits juste avant.

       Il restait, vide, et plus aucun ecran ne le montrait : la liste des comptes
       saute les etablissements sans compte. Il ne reapparaissait que dans la
       liste de l'etape 2 d'un ajout, ou la regle propose les vides sous
       n'importe quel type — d'ou l'impression d'une memoire residuelle, un
       appartement qu'on avait supprime et qui revient proposer de s'y rattacher.

       Apres la pierre tombale, jamais avant : celle-ci recopie le nom de
       l'etablissement dans son champ `broker`, et les releves passes s'en servent
       pour nommer leur colonne. */
    if (dernierDeSonEtab) {
      Store.state.etabs = Store.state.etabs.filter(x => x.id !== etab.id);
    }
    refreshAccounts(); Store.save();
    if (currentView() === 'ficheCompte') location.hash = '#/accounts'; else render();
    toast(`${guill(nomCompteV2(c))} ${trad('supprimé')}`);
  },

  'scinder-cash'(btn) {
    const c = compteById(btn.dataset.id);
    if (!c) return;
    c.cash = c.cash || [];
    const dejaPris = new Set(c.cash.map(e => e.affectation));
    const libre = AFFECTATIONS.find(([v]) => !dejaPris.has(v));
    if (!libre) { toast(trad('Les quatre affectations sont déjà prises sur ce compte.')); return; }
    c.cash.push({ montant: 0, affectation: libre[0] });
    Store.save(); render();
  },
  async 'retirer-cash'(btn) {
    const c = compteById(btn.dataset.id);
    const i = +btn.dataset.i;
    if (!c || !c.cash?.[i]) return;
    const e = c.cash[i];
    if (num(e.montant) && !await askConfirm(
      trad('Retirer cette part de {v} ?').replace('{v}', fmtEUR(num(e.montant)))
      + '\n\n' + trad('Le montant sortira du patrimoine. Réversible avec Ctrl+Z.'),
      { ok: 'Retirer', danger: true })) return;
    c.cash.splice(i, 1);
    Store.save(); render();
  },

  async 'ajouter-placement'(btn) {
    const c = compteById(btn.dataset.id);
    if (!c) return;
    const t = typeCompte(c.type);
    /* Une seule nature possible : la deduire est juste, et la demander serait
       poser une question qui n'a qu'une reponse. Une enveloppe en porte cinq,
       et la deduire revient a tirer au sort — `find()` rendait « actions », donc
       un fonds euros et une SCPI tombaient tous deux en actifs de marche sans
       que rien ne le dise. La question se pose alors, et ses options se derivent
       de la liste du type : celle qu'on y ajoutera demain y apparaitra sans
       qu'on y pense. */
    /* Un contrat sans poche de cash (`sansCash`) garde `liquidites` pour ce
       qu'elle y veut dire : un fonds monetaire, qui est une ligne. Ailleurs le
       cash passe par les parts du compte, et la classe ne s'ajoute pas ici. */
    const possibles = (t.classes || []).filter(x => x !== 'liquidites' || t.sansCash);
    const parDefaut = possibles.find(x => x !== 'liquidites') || possibles[0] || 'nonCote';
    const demandeSupport = possibles.length > 1;
    const v = await askForm({
      titre: trad('Placement dans {v}').replace('{v}', nomCompteV2(c)),
      sous: demandeSupport
        ? trad('c’est toi qui en donnes la valeur')
        : `${CLASSES_ACTIFS[parDefaut] || parDefaut} · ${trad('c’est toi qui en donnes la valeur')}`,
      ok: 'Ajouter',
      champs: [
        ...(demandeSupport ? [{ cle: 'classe', label: trad('Support'), type: 'liste',
              valeur: parDefaut, options: possibles.map(x => [x, x === 'liquidites'
                ? trad('Liquidités, un fonds monétaire') : (CLASSES_ACTIFS[x] || x)]),
              aide: trad(enContrat(t) ? 'ce que le contrat propose : un fonds actions, un fonds euros, une SCPI'
                                      : 'ce que le plan propose : un fonds actions, un fonds garanti, un fonds monétaire') }] : []),
        ...champsPlacement(parDefaut, null, t.prete, t)
          .map(ch => demandeSupport && ch.cle === 'libelle' ? { ...ch, exemple: 'ex. le nom du fonds ou du support' } : ch),
      ],
    });
    if (!v) return;
    const classe = demandeSupport ? (v.classe || parDefaut) : parDefaut;
    c.lignes = c.lignes || [];
    c.lignes.push(litPlacement(v, { id: 'l' + Date.now().toString(36), classe }, t));
    refreshAccounts(); Store.save(); render();
    toast(`${guill(v.libelle)} ${trad('ajouté')} · ${fmtEUR0(num(v.valeur))}`);
  },

  /* La sortie d'un placement non coté, et les trois mouvements qu'elle écrit.

     Elle passe par `cederPlacement()`, jamais par la fiche : une cession n'est
     pas une correction de valeur. Corriger la valeur à zéro puis archiver aurait
     donné le même patrimoine et perdu tout le reste — le produit encaissé, la
     plus-value réalisée, la date. C'est ce que faisait « Archiver » tout seul,
     et c'est ce qui manquait. */
  async 'ceder-placement'(btn) {
    const c = compteById(btn.dataset.id);
    const i = +btn.dataset.i;
    const l = c && (c.lignes || [])[i];
    if (!l) return;
    const v = await askCession(c.id, i);
    if (!v) return;
    const a = cederPlacement({ compteId: c.id, index: i, ...v });
    if (!a) { toast(trad('Rien à enregistrer')); return; }
    if (a.erreur) { toast(a.erreur); return; }
    refreshAccounts(); Store.save();
    if (c.statut === 'archive') ACTIONS.goto({ dataset: { view: 'accounts', anchor: '' } });
    else render();
    const mot = v.nature === 'defaut' ? trad('Défaut enregistré')
      : v.nature === 'remboursement' ? trad('Remboursement enregistré')
      : trad('Cession enregistrée');
    toast(`${mot}${deuxPoints()} ${a.realised === null
      ? `${fmtEUR(a.produit)} ${trad('encaissés')}` : fmtSigned(a.realised)}`);
  },
  async 'editer-placement'(btn) {
    const c = compteById(btn.dataset.id);
    const i = +btn.dataset.i;
    const l = c && (c.lignes || [])[i];
    if (!l) return;
    const v = await askForm({
      titre: l.libelle || 'Placement',
      sous: `${CLASSES_ACTIFS[l.classe] || l.classe} · ${nomCompteV2(c)}`,
      ok: 'Enregistrer',
      champs: [...champsPlacement(l.classe, l, typeCompte(c.type).prete, typeCompte(c.type)),
        ...champsSociete(c, l),
        { cle: 'supprimer', label: trad('Retirer ce placement'), type: 'case',
          aide: trad('La ligne disparaît en validant, et son montant quitte ton patrimoine. ')
              + 'Réversible avec Ctrl+Z' }],
    });
    if (!v) return;
    if (v.supprimer) {
      c.lignes.splice(i, 1);
      nettoyerSocietes();
      refreshAccounts(); Store.save(); render();
      toast(`${guill(l.libelle)} ${trad('retiré')}`);
      return;
    }
    Object.assign(l, litPlacement(v, l, typeCompte(c.type)));
    appliquerChoixSociete(c, i, v);
    /* L'AUTRE SENS DU MEME NOM, et il manquait. Sur un actif terminal le compte
       EST le placement, mais c'est le nom du COMPTE que l'en-tete, la liste des
       actifs et les menus lisent — `nomCompteV2()` le prend en premier.
       Renommer depuis cette fenetre-ci ne touchait que la ligne : le titre
       gardait l'ancien nom au-dessus du nouveau, et rien a l'ecran ne disait
       lequel comptait ni ou le corriger. Meme garde qu'au retour, et meme refus
       d'ecrire une chaine vide. */
    if (estActifTerminal(typeCompte(c.type))
        && (c.lignes || []).length === 1 && !(c.cash || []).length) {
      if (String(v.libelle || '').trim()) c.libelle = String(v.libelle).trim();
      /* La date fait le meme chemin que le nom, pour la meme raison : la fiche
         lit `c.ouvertLe` quand ce formulaire-ci ecrit `l.dateAcquisition`.
         Deux dates pour une seule entree, et celle qui s'affichait n'etait pas
         celle qu'on venait de saisir. Vide, elle s'efface plutot que d'ecrire
         une chaine vide, comme le fait `pose()` de l'autre cote. */
      if ('dateAcquisition' in v) {
        if (v.dateAcquisition) c.ouvertLe = v.dateAcquisition;
        else delete c.ouvertLe;
      }
    }
    refreshAccounts(); Store.save(); render();
    toast(`${guill(l.libelle)} · ${fmtEUR0(num(v.valeur))}`);
  },

  async 'ajouter-loyer'(btn) {
    const c = compteById(btn.dataset.id);
    if (!c) return;
    const direct = estBienEnDirect(c);
    const v = await askForm({
      titre: direct ? trad('Loyer de {v}').replace('{v}', nomCompteV2(c))
                    : trad('Revenu de {v}').replace('{v}', nomCompteV2(c)),
      /* La convention du loyer, et il n'y en a qu'une : le loyer du logement
         AVANT les depenses du proprietaire. Une aide qui dirait charges deduites
         si tu les paies serait fausse, puisque `cashFlowBien()` retranche
         ensuite les charges rattachees au bien : qui aurait compris net de
         charges les verrait retirees deux fois, et son cash-flow baisserait
         d'autant.

         Les montants deja saisis ne sont pas touches : personne ne peut savoir
         comment un ancien texte a ete lu. Seule la convention des saisies a venir
         compte, et l'aide la dit. */
      sous: direct
        ? trad('Le loyer hors charges récupérables que tu perçois personnellement. Les charges du propriétaire se déclarent séparément et sont déduites une seule fois.')
        : trad('Ce que ce placement te verse. Les frais se déclarent séparément et sont déduits une seule fois'),
      ok: 'Ajouter',
      valide: v => num(v.amount) > 0 ? null
        : { cle: 'amount', message: direct ? trad('Le loyer mensuel doit être supérieur à 0.')
                                           : trad('Le montant mensuel doit être supérieur à 0.') },
      champs: [
        { cle: 'label', label: 'Source', type: 'texte', requis: true, max: NOM_LIGNE_MAX,
          valeur: direct ? `Loyer ${nomCompteV2(c)}`
                         : `${trad('Distribution')} ${nomCompteV2(c)}`,
          exemple: 'ex. Loyer studio Lyon' },
        { cle: 'amount', label: trad('Montant mensuel ({dev})'), type: 'nombre',
          requis: true, exemple: '0' },
      ],
    });
    if (!v) return;
    Store.state.budget.income.push({ label: v.label, amount: num(v.amount), bienId: c.id });
    Store.save(); render();
    toast(`${guill(v.label)} · ${fmtEUR0(num(v.amount))} ${trad('/ mois')}`);
  },

  async 'ajouter-charge-bien'(btn) {
    const c = compteById(btn.dataset.id);
    if (!c) return;
    /* Les postes d'un bien sont proposes, pas imposes : taxe fonciere,
       copropriete, travaux, plus l'assurance qui va avec son usage. Un champ
       vide obligeait a se souvenir de ce qu'un logement coute, et la provision
       pour travaux est justement celle qu'on oublie. Ceux deja nommes sur un
       autre bien suivent, sans doublon.

       Sur un PLACEMENT, la liste est tout autre — des frais, pas des charges de
       proprietaire — et `chargesProposees` la choisit. La periode par defaut et
       l'exemple en viennent aussi : ils se lisent du premier poste propose,
       donc rien d'autre n'a a connaitre les deux mondes. */
    const direct = estBienEnDirect(c);
    const proposes = chargesProposees(c);
    const aidePoste = direct && usageBien(c) === 'locative'
      ? trad('Le loyer se saisit hors charges : n’entre ici que ce qui reste à ta charge de propriétaire, une fois déduit ce que le locataire rembourse. La taxe foncière suit la même règle si une part t’est remboursée.')
      : null;
    const v = await askForm({
      titre: (direct ? trad('Charge de {v}') : trad('Frais de {v}'))
        .replace('{v}', nomCompteV2(c)),
      sous: trad('Le montant se saisit tel qu’il est facturé, le budget ramène au mois'),
      ok: 'Ajouter',
      champs: [
        { cle: 'label', label: direct ? 'Poste' : 'Type de frais', type: 'texte',
          requis: true, max: NOM_LIGNE_MAX,
          exemple: trad('ex. {v}').replace('{v}', trad(proposes[0][0])),
          ...(aidePoste ? { aide: aidePoste } : {}),
          suggestions: [...proposes.map(([l]) => l), ...valeursConnues('posteBien')]
            .filter((l, i, t) => t.findIndex(x => x.toLowerCase() === l.toLowerCase()) === i) },
        { cle: 'amount', label: 'Montant', type: 'nombre', exemple: '0' },
        { cle: 'period', label: 'Facturé', type: 'liste', options: CHARGE_PERIODES,
          valeur: proposes[0][1] },
        { cle: 'echeanceLe', label: trad('Prochaine échéance'), type: 'date',
          aide: trad('une échéance, passée ou à venir : les suivantes se déduisent de la périodicité') },
        { cle: 'provider', label: 'Organisme', type: 'texte', exemple: 'ex. Trésor public',
          suggestions: valeursConnues('organisme') },
      ],
    });
    if (!v) return;
    Store.state.budget.fixedCharges.push({
      label: v.label, amount: num(v.amount), period: v.period,
      echeanceLe: v.echeanceLe || '',
      provider: v.provider || '', shares: {}, creditId: null, bienId: c.id,
    });
    Store.save(); render();
    toast(`${guill(v.label)} · ${fmtEUR(chargeMensuelle({ amount: num(v.amount), period: v.period }))} ${trad('/ mois')}`);
  },

  async 'ajouter-credit'(btn) {
    const e = etabById(btn.dataset.id);
    if (!e) return;
    const v = await askForm({
      titre: trad('Crédit chez {e}').replace('{e}', e.nom),
      sous: trad('Il pèse en négatif sur le patrimoine net'),
      ok: 'Ajouter',
      valide: v => validerCreditSaisi(v),
      champs: [
        { cle: 'libelle', label: 'Intitulé', type: 'texte', requis: true, max: NOM_LIGNE_MAX, exemple: 'ex. Prêt immobilier' },
        { cle: 'montant', label: trad('Capital restant dû ({dev})'), type: 'nombre', exemple: '0',
          aide: trad('La dette qui reste personnellement à ta charge. Elle se déduit de ton '
            + 'patrimoine net et n’est jamais divisée par une quote-part de bien ou une '
            + 'répartition de charge.') },
        { cle: 'initial', label: trad('Capital emprunté au départ ({dev})'), type: 'nombre', exemple: '0',
          aide: trad('facultatif, sert à mesurer ce qui est déjà remboursé') },
        { cle: 'mensualite', label: trad('Mensualité ({dev})'), type: 'nombre', exemple: '0', aide: trad('facultatif') },
        { cle: 'taux', label: trad('Taux annuel (%)'), type: 'nombre', exemple: '0',
          aide: trad('facultatif, il sert à suivre le capital qui reste') },
        { cle: 'tauxAssurance', label: trad('Taux d’assurance (%)'), type: 'nombre', exemple: '0',
          aide: trad('facultatif, environ 0,3 % du capital emprunté : elle sort de la mensualité sans rembourser') },
        { cle: 'preteur', label: 'Prêteur', type: 'texte', exemple: 'ex. Ma banque',
          suggestions: valeursConnues('preteur') },
        champPartCredit(),
        ...comptesDuPreteur(e.id).length > 1 ? [{ cle: 'bienId',
          label: trad('Ce crédit finance'), type: 'liste',
          options: [['', trad('à préciser')], ...comptesDuPreteur(e.id)],
          aide: trad('sans lui, ce prêteur tenant plusieurs comptes, aucune fiche '
                   + 'ne peut savoir lequel porte cette dette') }] : [],
        { cle: 'charge', label: trad('Ajouter une charge mensuelle fixe'), type: 'case', valeur: true,
          aide: trad('seulement si tu renseignes une mensualité. Si cette mensualité est '
            + 'ajoutée aux charges fixes, Longward compte le montant facturé ; une éventuelle '
            + 'répartition avec une autre personne reste informative.') },
      ],
    });
    if (!v) return;
    e.dettes = e.dettes || [];
    const candidats = comptesDuPreteur(e.id);
    const seul = candidats.length === 1 ? candidats[0][0] : null;
    e.dettes.push({ id: 'd' + Date.now(),
      libelle: v.libelle, montant: num(v.montant),
      initial: estDeclare(v.initial) ? num(v.initial) : null,
      mensualite: estDeclare(v.mensualite) ? num(v.mensualite) : null,
      /* `estDeclare` et non `|| null` : un pret familial a 0 % perdait son taux
         a l'enregistrement meme, et se retrouvait aussitot dans l'etat « taux
         inconnu » — celui ou l'application refuse de projeter quoi que ce soit.
         Le defaut n'etait pas seulement a la lecture. */
      taux: estDeclare(v.taux) ? num(v.taux) : null,
      tauxAssurance: estDeclare(v.tauxAssurance) ? num(v.tauxAssurance) : null,
      part: lirePartCredit(v.partCredit),
      bienId: v.bienId || seul,
      preteur: v.preteur || '', note: '', verifieLe: todayISO() });
    Store.save(); render();
    const posee = v.charge && creerChargeDuCredit(e.dettes[e.dettes.length - 1]);
    if (posee) { Store.save(); render(); }
    toast(posee
      ? `${trad('Crédit')} ${guill(v.libelle)} ${trad('ajouté, et sa charge de')} `
        + `${fmtEUR0(num(v.mensualite))} ${trad('/ mois')}`
      : `${trad('Crédit')} ${guill(v.libelle)} ${trad('ajouté')}`);
  },

  async 'editer-credit'(btn) {
    const e = etabById(btn.dataset.etab);
    const i = +btn.dataset.i;
    const d = e && (e.dettes || [])[i];
    if (!d) return;
    const siens = COMPTES().filter(c => c.etabId === e.id && c.statut !== 'archive');
    const autres = (e.dettes || []).length - 1;
    const lien = chargeDuCredit(d.id);
    const v = await askForm({
      titre: d.libelle || 'Crédit',
      sous: [trad('chez {e}').replace('{e}', e.nom),
        lien ? trad('remboursé par {c}, {v} par mois')
          .replace('{c}', guill(lien.charge.label || trad('charge fixe')))
          .replace('{v}', fmtEUR0(chargeMensuelle(lien.charge))) : '',
        siens.length ? `${siens.map(c => nomCompteV2(c)).join(', ')} · ${fmtEUR0(
          siens.reduce((s, c) => s + valeurCompte(c), 0))}` : trad('aucun compte rattaché'),
        autres > 0 ? trad(autres > 1 ? '{n} autres crédits ici' : '{n} autre crédit ici')
          .replace('{n}', autres) : '',
      ].filter(Boolean).join(' · '),
      ok: 'Enregistrer',
      champs: [
        { cle: 'montant', label: trad('Capital restant dû ({dev})'), type: 'nombre', valeur: num(d.montant),
          aide: (() => {
            const pr = projectionCredit(d);
            if (pr.projete == null || pr.ecart < 1) {
              return 'le premier champ : c’est celui qu’on vient corriger';
            }
            return trad('d’après ta mensualité, {v} après {n} mois : à recopier si tu '
              + 'n’as rien remboursé par avance')
              .replace('{v}', fmtEUR0(pr.projete)).replace('{n}', pr.moisDepuis);
          })() },
        { cle: 'verifieLe', label: trad('Vérifié le'), type: 'date', valeur: d.verifieLe || '',
          aide: trad('le jour où tu as lu ce capital chez ta banque') },
        { cle: 'libelle', label: 'Intitulé', type: 'texte', requis: true, max: NOM_LIGNE_MAX, valeur: d.libelle || '' },
        { cle: 'initial', label: trad('Capital emprunté au départ ({dev})'), type: 'nombre',
          valeur: estDeclare(d.initial) ? num(d.initial) : '',
          aide: trad('facultatif, sert à mesurer ce qui est déjà remboursé') },
        ...(lien ? [] : [{ cle: 'mensualite', label: trad('Mensualité ({dev})'), type: 'nombre',
          valeur: estDeclare(d.mensualite) ? num(d.mensualite) : '',
          aide: trad('facultatif. Mieux : rattache-le à une charge fixe, le montant ne sera alors saisi qu’une fois') }]),
        { cle: 'taux', label: trad('Taux annuel (%)'), type: 'nombre',
          /* `estDeclare` : rouvrir la fenetre d'un pret a 0 % affichait un champ
             vide, et l'enregistrer sans y toucher effaçait donc le taux. */
          valeur: estDeclare(d.taux) ? num(d.taux) : '',
          aide: trad('facultatif, il sert à suivre le capital qui reste') },
        { cle: 'tauxAssurance', label: trad('Taux d’assurance (%)'), type: 'nombre',
          valeur: estDeclare(d.tauxAssurance) ? num(d.tauxAssurance) : '',
          aide: trad('facultatif, environ 0,3 % du capital emprunté : elle sort de la mensualité sans rembourser') },
        champPartCredit(estDeclare(d.part) ? num(d.part) : ''),
        ...comptesDuPreteur(e.id).length > 1 ? [{ cle: 'bienId',
          label: trad('Ce crédit finance'), type: 'liste', valeur: d.bienId || '',
          options: [['', trad('à préciser')], ...comptesDuPreteur(e.id)],
          aide: trad('sans lui, ce prêteur tenant plusieurs comptes, aucune fiche '
                   + 'ne peut savoir lequel porte cette dette') }] : [],
        { cle: 'preteur', label: 'Prêteur', type: 'texte', valeur: d.preteur || '',
          exemple: 'ex. Ma banque', suggestions: valeursConnues('preteur') },
        ...(lien ? [] : [{ cle: 'charge', label: trad('Ajouter une charge mensuelle fixe'),
          type: 'case', valeur: true,
          aide: trad('seulement si une mensualité est renseignée. Si cette mensualité est '
            + 'ajoutée aux charges fixes, Longward compte le montant facturé ; une éventuelle '
            + 'répartition avec une autre personne reste informative.') }]),
        ...(lien ? [{ cle: 'supprimerCharge',
          label: trad('… et la charge « {l} » qui le rembourse').replace('{l}',
            lien.charge.label || trad('Charge fixe')), type: 'case', valeur: true,
          aide: trad('décoche pour la garder : elle redeviendra une charge fixe '
                   + 'ordinaire, avec le même montant') }] : []),
        { cle: 'supprimer', label: trad('Supprimer ce crédit'), type: 'case',
          aide: `${trad('Le patrimoine net remontera de')} ${fmtEUR0(num(d.montant))}. ${
            trad('Réversible avec Ctrl+Z.')}` },
      ],
      valide: v => (v.supprimer ? null : validerCreditSaisi(v)),
    });
    if (!v) return;
    if (v.supprimer) {
      const nom = d.libelle || trad('Crédit');
      const rendu = num(d.montant);
      /* Avant le retrait : une charge ne peut pas garder un `creditId` vers une
         dette qui n'existe plus. Elle part, ou elle redevient ordinaire. */
      const chargeNom = delierChargeDuCredit(d.id, { retirer: !!v.supprimerCharge });
      e.dettes.splice(i, 1);
      Store.save(); render();
      toast(`${guill(nom)} ${trad('supprimé')} · ${trad('patrimoine net')} +${fmtEUR0(rendu)}`
        + (chargeNom ? ` · ${v.supprimerCharge ? trad('charge supprimée')
                                               : trad('charge conservée')}` : ''));
      return;
    }
    const avant = num(d.montant);
    d.verifieLe = dateApresSaisie({ avant: d.montant, apres: num(v.montant),
      dateAvant: d.verifieLe || '', dateSaisie: v.verifieLe || '', genre: 'credit' });
    d.libelle = v.libelle || d.libelle;
    d.montant = num(v.montant);
    d.initial = estDeclare(v.initial) ? num(v.initial) : null;
    if (v.mensualite !== undefined)
      d.mensualite = estDeclare(v.mensualite) ? num(v.mensualite) : null;
    /* Un taux declare a zero reste zero : `|| null` le renvoyait dans l'etat
       « taux inconnu » a chaque enregistrement. */
    d.taux = estDeclare(v.taux) ? num(v.taux) : null;
    d.tauxAssurance = estDeclare(v.tauxAssurance) ? num(v.tauxAssurance) : null;
    if (v.partCredit !== undefined) d.part = lirePartCredit(v.partCredit);
    /* `rattacherCredit` et non une affectation nue : la charge qui rembourse ce
       credit doit suivre, sans quoi sa mensualite resterait comptee dans le
       cash-flow d'un bien qui ne la paie plus. */
    if (v.bienId !== undefined) rattacherCredit(d, v.bienId);
    d.preteur = v.preteur || '';
    Store.save(); render();
    const baisse = avant - d.montant;
    toast(Math.abs(baisse) > 0.005
      ? `${d.libelle} · ${fmtEUR0(d.montant)} ${trad('restant dû, patrimoine net')} ${
        baisse > 0 ? `+${fmtEUR0(baisse)}` : `−${fmtEUR0(-baisse)}`}`
      : `${d.libelle} ${trad('enregistré')}`);
    if (v.charge && creerChargeDuCredit(d)) {
      Store.save(); render();
      toast(`${guill(d.libelle)} ${trad('ajoutée aux charges fixes')} · ${fmtEUR0(fixedTotal())} ${trad('/ mois')}`);
    }
  },
  async 'retirer-credit'(btn) {
    const e = etabById(btn.dataset.id);
    const i = +btn.dataset.i;
    if (!e || !e.dettes?.[i]) return;
    const d = e.dettes[i];
    if (!await askConfirm(`${trad('Retirer le crédit')} ${guill(d.libelle)} ?\n\n${trad('Le patrimoine net remontera de')} ${fmtEUR(num(d.montant))}. ${trad('Réversible avec Ctrl+Z.')}`,
      { ok: 'Retirer', danger: false })) return;
    e.dettes.splice(i, 1);
    Store.save(); render();
  },

  'voir-releve'(btn) {
    openApercu('releveMois', btn.dataset.i);
  },

  async 'edit-month'(btn) {
    await askMonthlySnapshot(+btn.dataset.i);
  },

  async 'ajouter-releve'() {
    if (!aUnRelevePatrimonial()) {
      const enregistrer = await askConfirm(
        `${trad('Avant ton premier relevé')}\n${
          trad('Commence par ajouter les comptes et actifs qui composent ton patrimoine, tes différentes poches. Chaque mois, Longward additionnera la valeur de toutes ces poches pour enregistrer ton patrimoine total et suivre son évolution dans le temps.')}\n${
          trad('Tu pourras toujours ajouter d’autres poches plus tard.')}`,
        { danger: false, ok: trad('Enregistrer mon relevé'), refus: trad('Vérifier mes comptes et actifs') });
      if (enregistrer === false) { location.hash = '#/accounts'; return; }
      if (!enregistrer) return;
    }
    await askMonthlySnapshot(indexReleve(currentMonthKey()));
  },
});

partieChargee('assets/app-08-actions-comptes.js');
