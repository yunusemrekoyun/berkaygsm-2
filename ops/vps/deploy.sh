#!/usr/bin/env bash

set -euo pipefail

APP_ROOT="${APP_ROOT:-/srv/ceplife}"
RELEASES_ROOT="${RELEASES_ROOT:-${APP_ROOT}/releases}"
CURRENT_LINK="${CURRENT_LINK:-${APP_ROOT}/current}"
SHARED_ENV_FILE="${SHARED_ENV_FILE:-${APP_ROOT}/shared/.env}"
APP_USER="${APP_USER:-ceplife}"
APP_GROUP="${APP_GROUP:-ceplife}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
PM2_CONFIG="${PM2_CONFIG:-${APP_ROOT}/shared/ecosystem.config.cjs}"
LOCAL_PM2_CONFIG="${LOCAL_PM2_CONFIG:-./ops/vps/ecosystem.config.cjs}"
STAMP="$(date +%Y%m%d%H%M%S)"
RELEASE_DIR="${RELEASES_ROOT}/${STAMP}"

if [[ ! -f "${SHARED_ENV_FILE}" ]]; then
  echo "Missing env file: ${SHARED_ENV_FILE}"
  exit 1
fi

mkdir -p "${RELEASE_DIR}"

rsync -a \
  --exclude ".git" \
  --exclude ".next" \
  --exclude "node_modules" \
  --exclude "exports" \
  --exclude "scripts" \
  ./ "${RELEASE_DIR}/"

cd "${RELEASE_DIR}"
npm ci
cp "${SHARED_ENV_FILE}" .env
npm run build

if [[ -f "${LOCAL_PM2_CONFIG}" ]]; then
  cp "${LOCAL_PM2_CONFIG}" "${PM2_CONFIG}"
fi

mkdir -p "${RELEASE_DIR}/standalone"
rsync -a .next/standalone/ "${RELEASE_DIR}/standalone/"
mkdir -p "${RELEASE_DIR}/standalone/.next"
rsync -a .next/static/ "${RELEASE_DIR}/standalone/.next/static/"
rsync -a public/ "${RELEASE_DIR}/standalone/public/"
cp "${SHARED_ENV_FILE}" "${RELEASE_DIR}/standalone/.env"
chown "${APP_USER}:${APP_GROUP}" "${PM2_CONFIG}"

chown -R "${APP_USER}:${APP_GROUP}" "${RELEASE_DIR}"
ln -sfn "${RELEASE_DIR}/standalone" "${CURRENT_LINK}"

set -a
# shellcheck disable=SC1090
source "${SHARED_ENV_FILE}"
set +a

pm2 startOrReload "${PM2_CONFIG}" --update-env
pm2 save

find "${RELEASES_ROOT}" -mindepth 1 -maxdepth 1 -type d | sort | head -n -"${KEEP_RELEASES}" | xargs -r rm -rf

echo "Deploy completed: ${RELEASE_DIR}"
