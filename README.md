# Vue 3 + Vite

This template should help get you started developing with Vue 3 in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about IDE Support for Vue in the [Vue Docs Scaling up Guide](https://vuejs.org/guide/scaling-up/tooling.html#ide-support).

## CI/CD Deploy (GitHub Actions -> DigitalOcean)

This repository includes a workflow at `.github/workflows/deploy.yml`.

### Trigger

- Runs on push to `main`
- Can also be started manually from the Actions tab (`workflow_dispatch`)

### What it does

1. Installs dependencies (`npm ci`)
2. Builds the app (`npm run build`)
3. Connects to `164.92.172.190` using SSH key auth
4. Uploads `dist/` to your server path using `rsync --delete`
5. Optionally runs a post-deploy command (for example reloading Nginx)

### Required GitHub secrets

Configure these in `Settings -> Secrets and variables -> Actions`:

- `DEPLOY_SSH_PRIVATE_KEY`: private key used by GitHub Actions to SSH into server
- `DEPLOY_USER`: Linux user on server (for example `root` or `deploy`)
- `DEPLOY_PATH`: destination path on server (for example `/var/www/consilium-frontend`)

Optional:

- `DEPLOY_PORT`: SSH port (defaults to `22` if empty)
- `DEPLOY_POST_CMD`: command to run on server after deploy (for example `sudo systemctl reload nginx`)

### Quick server prep

On your server, ensure:

- SSH public key is present in `~/.ssh/authorized_keys` for `DEPLOY_USER`
- `DEPLOY_PATH` exists or can be created by that user
- Nginx/Apache serves files from `DEPLOY_PATH`
