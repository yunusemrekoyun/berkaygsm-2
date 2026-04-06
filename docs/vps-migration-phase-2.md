# VPS Migration Phase 2

This phase prepares the project for a Hostinger KVM2 deployment before the media adapter swap.

## Goals

- Move app hosting from Vercel to the VPS.
- Keep Cloudinary active for now.
- Prepare `media.ceplife.com` as the future media origin.
- Standardize deployment flow so the media migration can happen on stable infrastructure.

## Expected Server Layout

- App root: `/srv/ceplife`
- Releases: `/srv/ceplife/releases/<timestamp>`
- Active app: `/srv/ceplife/current`
- Shared env: `/srv/ceplife/shared/.env`
- Media root: `/srv/ceplife/media`
- Temp root: `/srv/ceplife/tmp`
- Logs: `/var/log/ceplife`

## What Was Added In Repo

- VPS bootstrap script: `ops/vps/bootstrap.sh`
- Deploy script: `ops/vps/deploy.sh`
- PM2 config: `ops/vps/ecosystem.config.cjs`
- App nginx template: `ops/nginx/ceplife.com.conf`
- Media nginx template: `ops/nginx/media.ceplife.com.conf`

## Manual Server Steps

1. Provision Ubuntu on Hostinger VPS.
2. Upload repo or clone it to the server.
3. Run bootstrap as root:
   `bash ops/vps/bootstrap.sh`
4. Copy PM2 config into shared path:
   `cp ops/vps/ecosystem.config.cjs /srv/ceplife/shared/ecosystem.config.cjs`
5. Create `/srv/ceplife/shared/.env`.
6. Install nginx configs into `/etc/nginx/sites-available/`.
7. Symlink enabled sites and reload nginx.
8. Point DNS:
   - `ceplife.com` -> VPS
   - `www.ceplife.com` -> VPS
   - `media.ceplife.com` -> VPS
9. Put Cloudflare in front after origin is confirmed healthy.
10. Run deploy:
    `bash ops/vps/deploy.sh`

## Required Production Env

Existing envs continue to work. Add these operational values on the VPS:

- `NODE_ENV=production`
- `PORT=3000`
- `HOSTNAME=127.0.0.1`
- `NEXT_PUBLIC_API_URL=/api`
- `MEDIA_MIGRATION_FREEZE=true` during migration windows only

## Current Status

- Freeze layer is ready.
- Standalone Next build is enabled.
- VPS deploy skeleton is ready.
- Cloudinary is still the active media backend.

## Next Phase

Phase 3 is the media abstraction layer:

- introduce a provider-based media storage adapter
- keep Cloudinary as provider A
- add local filesystem provider as provider B
- switch controllers to the adapter before migrating stored assets
