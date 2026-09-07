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

## Notes de mise en production

- Changer `JWT_SECRET` et le mot de passe HSV par défaut.
- Passer `DATABASE_URL` sur une instance PostgreSQL managée.
- `npm run build` dans `frontend/` produit les fichiers statiques (`dist/`) à servir
  derrière un reverse proxy / CDN, avec `VITE_API_URL` pointant vers l'API déployée.
