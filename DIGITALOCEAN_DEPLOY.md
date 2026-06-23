# Deploying ordertable-pilot to DigitalOcean App Platform

This app is a Next.js 15 + Prisma + PostgreSQL platform. The recommended host is
**DigitalOcean App Platform** with a **DigitalOcean Managed PostgreSQL** database.
A ready-to-use spec lives at [.do/app.yaml](.do/app.yaml).

---

## What the spec provisions

| Component | Purpose |
|-----------|---------|
| `web` service | Builds and serves the Next.js app (`npm run build` → `npm start`) |
| `ordertable-db` database | Managed PostgreSQL 16, used for both pooled and direct connections |
| `migrate` pre-deploy job | Runs `npx prisma migrate deploy` before every release |

The build command (`npm run build`) already runs `prisma generate`, so the Prisma
client is generated during the build. Schema migrations run in the pre-deploy job.

---

## Option A — Deploy from the dashboard (easiest)

1. Push your code to GitHub (already at `aazaan12-source/ordertable-pilot`).
2. Go to https://cloud.digitalocean.com/apps → **Create App**.
3. Choose **GitHub** → select the `ordertable-pilot` repo and the `main` branch.
4. When prompted, **Edit the app spec** (or import) and paste the contents of
   [.do/app.yaml](.do/app.yaml). This wires up the web service, database, and
   migration job in one step.
5. In **Settings → App-Level Environment Variables**, set the secret:
   - `NEXTAUTH_SECRET` → a long random string (generate one with the command below).
6. Click **Create Resources**. First deploy takes ~5–10 minutes.

Generate a secret:
```bash
openssl rand -base64 48
```

---

## Option B — Deploy from the CLI (`doctl`)

```bash
# 1. Install + authenticate doctl
brew install doctl
doctl auth init        # paste a DigitalOcean API token

# 2. Put your real secret into the spec (or set it after creation in the dashboard)
#    Edit .do/app.yaml -> NEXTAUTH_SECRET value, OR leave the placeholder and set it
#    encrypted in the dashboard after the app is created.

# 3. Create the app from the spec
doctl apps create --spec .do/app.yaml

# 4. Watch the deploy
doctl apps list
doctl apps logs <APP_ID> --type build --follow
```

To ship later changes, either rely on `deploy_on_push` (auto-deploys on push to
`main`) or run:
```bash
doctl apps update <APP_ID> --spec .do/app.yaml
```

---

## Environment variables

| Variable | Set by | Notes |
|----------|--------|-------|
| `DATABASE_URL` | spec → `${ordertable-db.DATABASE_URL}` | Managed DB conn string (SSL required) |
| `DIRECT_URL` | spec → `${ordertable-db.DATABASE_URL}` | Same DB; used by Prisma migrations |
| `NEXTAUTH_URL` | spec → `${APP_URL}` | Resolves to the app's https URL |
| `APP_URL` | spec → `${APP_URL}` | Same |
| `NEXTAUTH_SECRET` | **you** (encrypted secret) | `openssl rand -base64 48` |
| `PRISMA_CONNECTION_LIMIT` | spec | `1` |
| `PRISMA_POOL_TIMEOUT` | spec | `20` |
| `RECOVERY_*`, `CLOUDINARY_*` | optional | Add only if used (see `.env.example`) |

> **Custom domain:** after adding one in **Settings → Domains**, `${APP_URL}`
> updates automatically — no manual change to `NEXTAUTH_URL`/`APP_URL` needed.

---

## First-run database seeding

Migrations run automatically via the pre-deploy job. To seed demo/admin data
**once** after the first successful deploy, run the seed against the managed DB.
Get the connection string from the DO dashboard (Database → Connection Details),
then locally:

```bash
DATABASE_URL="<do-conn-string>" DIRECT_URL="<do-conn-string>" npm run prisma:seed
```

Alternatively use the DO **Console** for the `web` component and run
`npm run prisma:seed` there.

---

## Production checklist (from the project README)

1. Change all seed/demo passwords before public use.
2. Use a long random `NEXTAUTH_SECRET` (never commit it).
3. Keep DB URLs and secrets only in DO env vars / local `.env` (gitignored).
4. `NEXTAUTH_URL` / `APP_URL` must be HTTPS.
5. Enable 2FA on GitHub and DigitalOcean.
6. Take regular managed-database backups (enabled by default on DO managed PG).
7. Monitor build/runtime logs: `doctl apps logs <APP_ID> --follow`.

---

## Sizing notes

The spec uses the smallest tiers (`basic-xxs` instance, `db-s-1vcpu-1gb` database)
to keep cost low for a pilot. For production traffic, raise `instance_size_slug`,
`instance_count`, and the database `size`/`num_nodes` in [.do/app.yaml](.do/app.yaml).
For heavier load, add a DO **connection pool** (PgBouncer) and point `DATABASE_URL`
at the pooled port while keeping `DIRECT_URL` on the direct port.
