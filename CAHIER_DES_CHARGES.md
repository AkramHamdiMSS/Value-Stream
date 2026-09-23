# Cahier des charges — Pilotage ressources

Référence des règles métier **telles qu'implémentées** dans le code (rédigé
a posteriori à partir du backend et du frontend). Toute évolution doit
mettre ce fichier à jour dans le même commit.

## 1. Acteurs et droits

| Rôle / permission | Portée |
|---|---|
| SVO (compte `role: svo`) | Besoin de ses propres projets, lecture de la grille de charge |
| HSV (compte `role: hsv`) | Tous les droits implicitement (`hasPermission` retourne vrai) |
| `manageProjects` | Créer/supprimer des projets, réassigner le SVO |
| `viewAllProjects` | Voir tous les projets |
| `manageAllocations` | Modifier/valider les affectations (2ᵉ validation) |
| `proposeAllocations` | Proposer une affectation depuis sa propre sous-équipe (1ʳᵉ validation) |
| `viewDashboard` | Voir le dashboard ; vue minimale si aucun droit d'ensemble |
| `viewDemandQueue` | Voir la file des demandes |
| `managePool` | Pool : membres, temps de travail, dates d'arrivée/départ, indisponibilités (et imports ASCII/Tempo) |
| `manageRoles` | Comptes SVO, mots de passe, permissions |
| `viewActivity` | Journal d'activité |

Règle fondamentale : le matching offre/demande se fait sur
`sousEquipe` (Mobile / TPE Android / TPE Engage / Digital), jamais sur
`squad`, pour ne pas confondre les deux sous-équipes TPE.

## 2. Workflow d'une demande

1. Le SVO saisit des lignes par plage de semaines : 4 compteurs de profils
   (ou %, le produit `count × pct` est la valeur retenue), + commentaire.
2. Il soumet → statut `demandSubmitted`, notification HSV + Team Leads
   concernés par profil. La demande devient non modifiable jusqu'à
   réouverture.
3. Un Team Lead (ou le SVO avec `proposeAllocations`) propose des
   ressources **de sa sous-équipe** → lignes `status: pending`.
4. Le HSV valide (`approved`) ou supprime (rejet).
5. La file des demandes montre le statut par (projet × période × profil) :
   `untreated → proposed → partial → validated`, avec couverture % et
   semaines couvertes n/N calculées semaine par semaine.

Workflow de libération : le SVO demande la fin d'une affectation validée
(`releaseRequested` + note + nouveau %), le HSV confirme ou annule.

## 3. Unité et calculs de couverture

- Tout est calculé en **ETP·semaine** (1 personne à 100 % pendant 1 semaine),
  semaine par semaine (ISO, lundi), via `lib/coverage.js`.
- `covered = Σ_semaines min(besoin_hebdo, alloué_hebdo)` : une affectation
  ne « couvre » que les semaines qu'elle touche réellement, et jamais au-delà
  du besoin de cette semaine.
- Les affectations `pending` ne comptent jamais comme capacité.
- Les KPI de l'organisation sont calculés sur l'**horizon de planification**
  (semaine courante + N semaines, défaut 16, `?horizon=` jusqu'à 52) et sur
  les projets **soumis** uniquement ; le besoin en brouillon est rapporté à part.

## 4. Capacité nette (par personne × semaine)

`netCapacity = capacityPct × tenureFraction × (1 − unavailableFraction)`

- `capacityPct` : temps contractuel (1 = plein temps, 0,5 = mi-temps).
- `tenureFraction` : part des jours ouvrés de la semaine à l'intérieur de
  [`startDate`, `endDate`].
- `unavailableFraction` : part des **demi-journées** ouvrées couvertes par un
  congé **bloquant** (union, plafonnée à 1). Finesse demi-journée issue des
  champs ASCII `startdatetype/enddatetype`.
- Jours fériés tunisiens fixes exclus de la semaine (`lib/holidays.js`) ;
  fêtes mobiles via la variable d'env `HOLIDAYS_EXTRA="2026-03-21,…"`.
- Seules les indisponibilités **effectives** réduisent la capacité :
  `congé validé`, `maladie`, `formation`, `autre`, `congé` (saisie manuelle).
  `congé refusé` : ignoré. `congé demandé` : avertissement seulement.

## 5. Règles d'affectation (`checkAllocationFeasibility`)

Pour chaque semaine de la plage demandée :

- **Blocage (409)** si la capacité nette restante < % demandé (congé
  bloquant effectif, temps partiel, hors présence). Un congé d'une
  demi-journée ne bloque donc pas une affectation à 80 %.
- **Avertissement** (non bloquant, rapporté en `warnings` et affiché en
  toast ambre côté front) : sur-allocation (charge existante + demandé >
  capacité nette) ou demande de congé encore en attente RH.
- Un backup doit être dans la même sous-équipe, personne différente, et ne
  compte jamais dans la charge.

## 6. Intégrations

| Source | Usage | Statut de sécurité |
|---|---|---|
| Tempo Cloud v4 | heures réelles → `LoggedTime`, comparées au plan (ratio par profil ; les fériés retirent des heures attendues) | token API dédié, timeout court, `TEMPO_API_TOKEN` dans `.env` |
| ASCII (workmates) | Puppeteer → interception `/leaves/workmates`, mapping intelligent nom/prénom (`lib/nameMatcher.js`), statut par couleur (vert/orange/rouge) | identifiants `.env` uniquement, jamais loggés |
| Mail (nodemailer) | notifications validation/proposition/soumission/libération | optionnel, log console si non configuré |

## 7. Journal d'activité

Toute action d'écriture significative (projet, demande, affectation,
validation, libération, pool, rôles, imports) écrit dans `ActivityLog` :
auteur, action, projet éventuel.

## 8. Déploiement production

- Machine : `mssmobile@172.16.100.17`, app dans `~/Desktop/SVO`.
- Frontend buildé servi par `vite preview` sur `:5173`, API Express sur
  `:4000` (`HOST=0.0.0.0`), les deux en `nohup` avec logs
  `~/backend.log` / `~/frontend.log`.
- `./deploy-local.sh` : sauvegarde PostgreSQL horodatée → git pull →
  `npm install` → `prisma migrate deploy` → `prisma generate` → build front
  → arrêt/démarrage des deux services. Idempotent, aucune destruction de
  données (les migrations sont additives).
- Option CI/CD : `.github/workflows/deploy.yml` appelle le même script via
  le runner self-hosted (voir commentaires en tête du fichier).
