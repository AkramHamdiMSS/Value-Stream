#!/bin/bash
set -e

PROJECT_DIR="/Users/mssmobile/Desktop/SVO"
DB_NAME="pilotage_ressources"
BACKUP_DIR="/Users/mssmobile/backups"
LOG_FILE="/Users/mssmobile/backend.log"
FRONT_LOG_FILE="/Users/mssmobile/frontend.log"
FRONT_PORT=5173

echo "== Deploiement local sur ce Mac =="
echo "Repertoire : ${PROJECT_DIR}"

echo "-- Sauvegarde de la base de donnees..."
mkdir -p "${BACKUP_DIR}"
BACKUP_FILE="${BACKUP_DIR}/pilotage_ressources_$(date +%Y%m%d_%H%M%S).sql"
if command -v pg_dump > /dev/null 2>&1; then
  pg_dump -Fc "${DB_NAME}" > "${BACKUP_FILE}" || echo "!! pg_dump a echoue - continue sans sauvegarde"
  echo "OK Sauvegarde creee : ${BACKUP_FILE}"
else
  echo "!! pg_dump non disponible - passe la sauvegarde"
fi

echo "-- Pull des derniers changements..."
cd "${PROJECT_DIR}"
git pull origin main

echo "-- Arret de l'ancien backend et frontend..."
pkill -f "node.*src/server.js" || echo "Aucun processus backend trouve"
pkill -f "vite" || echo "Aucun processus frontend trouve"
sleep 2

echo "-- Installation des dependances backend..."
cd "${PROJECT_DIR}/backend"
npm install

echo "-- Application des migrations Prisma..."
npx prisma migrate deploy

echo "-- Regeneration du client Prisma..."
npx prisma generate

echo "-- Installation des dependances frontend..."
cd "${PROJECT_DIR}/frontend"
npm install

echo "-- Build du frontend..."
npm run build

echo "-- Demarrage du backend avec nohup..."
cd "${PROJECT_DIR}/backend"
HOST=0.0.0.0 nohup npm start > "${LOG_FILE}" 2>&1 &
sleep 3

echo "-- Verification que le backend est demarre..."
if pgrep -f "node.*src/server.js" > /dev/null; then
  echo "OK Backend demarre avec succes !"
else
  echo "!! Le backend ne semble pas demarre. Consultez les logs : ${LOG_FILE}"
  exit 1
fi

echo "-- Demarrage du frontend (build) sur le port ${FRONT_PORT}..."
cd "${PROJECT_DIR}/frontend"
nohup npx vite preview --host 0.0.0.0 --port "${FRONT_PORT}" --strictPort > "${FRONT_LOG_FILE}" 2>&1 &
sleep 3

echo "-- Verification que le frontend est demarre..."
if pgrep -f "vite preview" > /dev/null; then
  echo "OK Frontend demarre avec succes !"
else
  echo "!! Le frontend ne semble pas demarre. Consultez les logs : ${FRONT_LOG_FILE}"
  exit 1
fi

echo "== Deploiement termine =="
echo "Application  : http://172.16.100.17:${FRONT_PORT}"
echo "API          : http://172.16.100.17:4000/api/health"
echo "Logs backend : tail -f ${LOG_FILE}"
echo "Logs frontend: tail -f ${FRONT_LOG_FILE}"
echo ""
echo "Si le navigateur affiche ERR_CONNECTION_REFUSED, autorisez node dans le pare-feu :"
echo "  Reglages Systeme > Reseau > Coupe-feu > Options > ajouter node ou desactiver le coupe-feu"
