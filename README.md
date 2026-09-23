# Pilotage ressources

Application de pilotage des ressources : les SVO expriment un besoin par projet/semaine,
le Head of Value Stream (HSV) affecte des ressources du pool et le système détecte les
sur-allocations automatiquement. Voir [CAHIER_DES_CHARGES.md](CAHIER_DES_CHARGES.md) pour
le détail des règles métier.

## Structure

- `backend/` — API REST (Node.js + Express + Prisma + PostgreSQL), auth JWT avec mots de
  passe hachés (bcrypt).
- `frontend/` — Interface React (Vite), branchée sur l'API via `fetch`.

## Prérequis

- Node.js 18+
- PostgreSQL (en local : `brew install postgresql@16` puis `brew services start postgresql@16`)

## Démarrage — backend

```bash
cd backend
npm install
createdb pilotage_ressources   # si la base n'existe pas encore
npx prisma migrate dev         # crée les tables
npm run seed                   # données de démo
npm run dev                    # démarre l'API sur http://localhost:4000
```

La configuration (`backend/.env`) :
- `DATABASE_URL` — connexion PostgreSQL
- `JWT_SECRET` — secret de signature des tokens (à changer en production)
- `PORT` — port de l'API (4000 par défaut)

Comptes créés par le seed :
- **HSV** : `Head of Value Stream` / mot de passe `admin` (à changer dès la première connexion)
- **SVO** : Aymen Moncer, Taher Bekri, Abderraouf Zayen, Abir Hcine, Moncef Essalah,
  Oussama Cheikh, Abdelkader BelhajSlimene, Akram — sans mot de passe initial (le HSV en
  définit un depuis l'onglet **Rôles**).

## Démarrage — frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

`frontend/.env` contient `VITE_API_URL` (par défaut `http://localhost:4000/api`).

## Production (Mac 172.16.100.17)

L'application tourne sur le Mac de production : frontend `vite preview` sur `:5173`,
API sur `:4000`, les deux en `nohup`.

```bash
# Déployer depuis le Mac de développement :
ssh -i ~/.ssh/svo_deploy_key mssmobile@172.16.100.17 "cd ~/Desktop/SVO && git pull origin main && ./deploy-local.sh"

# ou directement sur le Mac de production :
cd ~/Desktop/SVO && ./deploy-local.sh
```

Le script sauvegarde la base (`~/backups/`), pull, installe, migre (additif),
build et redémarre backend + frontend. Voir `CAHIER_DES_CHARGES.md` §8.

Option CI/CD : enregistrer le runner self-hosted (voir commentaires en tête de
`.github/workflows/deploy.yml`) ; chaque push sur `main` déploie alors tout seul.

Variables d'env backend (`.env`) : `DATABASE_URL`, `JWT_SECRET`, `PORT`, `HOST`,
`ASCII_USERNAME`/`ASCII_PASSWORD` (import congés), `TEMPO_API_TOKEN` (temps réels),
`HOLIDAYS_EXTRA` (fêtes mobiles) et éventuellement le bloc SMTP pour les mails.
