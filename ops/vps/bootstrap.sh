#!/usr/bin/env bash

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "This script must be run as root."
  exit 1
fi

APP_USER="${APP_USER:-ceplife}"
APP_GROUP="${APP_GROUP:-ceplife}"
APP_ROOT="${APP_ROOT:-/srv/ceplife}"
MEDIA_ROOT="${MEDIA_ROOT:-${APP_ROOT}/media}"
TMP_ROOT="${TMP_ROOT:-${APP_ROOT}/tmp}"
RELEASES_ROOT="${RELEASES_ROOT:-${APP_ROOT}/releases}"
CURRENT_LINK="${CURRENT_LINK:-${APP_ROOT}/current}"
LOG_ROOT="${LOG_ROOT:-/var/log/ceplife}"
NODE_MAJOR="${NODE_MAJOR:-22}"

apt-get update
apt-get upgrade -y

apt-get install -y \
  ca-certificates \
  curl \
  ffmpeg \
  git \
  gnupg \
  logrotate \
  nginx \
  python3 \
  rsync \
  ufw \
  unzip \
  build-essential

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

npm install -g pm2

if ! getent group "${APP_GROUP}" >/dev/null; then
  groupadd --system "${APP_GROUP}"
fi

if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  useradd --system --gid "${APP_GROUP}" --create-home --home-dir "/home/${APP_USER}" --shell /bin/bash "${APP_USER}"
fi

install -d -o "${APP_USER}" -g "${APP_GROUP}" "${APP_ROOT}"
install -d -o "${APP_USER}" -g "${APP_GROUP}" "${MEDIA_ROOT}"
install -d -o "${APP_USER}" -g "${APP_GROUP}" "${TMP_ROOT}"
install -d -o "${APP_USER}" -g "${APP_GROUP}" "${RELEASES_ROOT}"
install -d -o "${APP_USER}" -g "${APP_GROUP}" "${LOG_ROOT}"

if [[ ! -L "${CURRENT_LINK}" && ! -d "${CURRENT_LINK}" ]]; then
  ln -s "${RELEASES_ROOT}" "${CURRENT_LINK}"
fi

ufw allow OpenSSH
ufw allow "Nginx Full"
ufw --force enable

cat <<EOF
Bootstrap completed.

Created:
  app user:       ${APP_USER}
  app root:       ${APP_ROOT}
  media root:     ${MEDIA_ROOT}
  tmp root:       ${TMP_ROOT}
  releases root:  ${RELEASES_ROOT}
  current link:   ${CURRENT_LINK}
  log root:       ${LOG_ROOT}

Installed:
  nginx, node, pm2, ffmpeg, rsync, ufw, logrotate
EOF
