# Ashan Motors

Dealership website: a public showroom (landing page, new arrivals, searchable car listings, WhatsApp / Instagram / TikTok / YouTube links) and a password-protected admin stockroom for adding, editing, marking sold and removing cars.

- `client/` — Angular storefront and admin UI
- `server/` — NestJS API (cars, collections, admin sign-in, photo uploads)

## Run locally

```bash
# once — start PostgreSQL (needs Docker Desktop running)
docker compose up -d

# once — create the server settings file
cp server/.env.example server/.env

# terminal 1 — API on http://localhost:3000
cd server
npm install
npm run start:dev

# terminal 2 — site on http://localhost:4200 (forwards /api to port 3000, see client/proxy.conf.json)
cd client
npm install
npm start
```

## Deploy to Vercel

The whole app deploys as **one Vercel project**: the Angular site is served as static files and the NestJS API runs as a serverless function at `/api` (see [vercel.json](vercel.json) and [api/index.js](api/index.js)). The database is PostgreSQL from **Neon** (free tier, connects to Vercel in a few clicks).

1. **Import the repo** — [vercel.com/new](https://vercel.com/new) → *Import Git Repository* → pick `ashan-motors-cardealership`. Leave *Framework Preset* as **Other** and *Root Directory* as `./` (the build settings come from `vercel.json`). Don't deploy yet — or let the first deploy fail; it needs the settings below.
2. **Add the database** — in the project: *Storage* → *Create Database* → **Neon (Postgres)** → *Connect*. This adds `DATABASE_URL` to the project automatically.
3. **Add environment variables** — *Settings* → *Environment Variables*:

   | Name | Value |
   | --- | --- |
   | `ADMIN_PASSWORD` | a strong password for the admin page |
   | `SESSION_SECRET` | any long random text (e.g. 40+ random characters) |
   | `DATABASE_URL` | added by step 2 (if you created the database elsewhere, paste its connection string, including `?sslmode=require`) |

4. **Deploy** — *Deployments* → *Redeploy* (or push a commit). Tables are created on the first request and the sample cars are added once; delete them from the admin page when you add real stock (set `SEED_SAMPLE_DATA=false` to start empty instead).
5. **Your domain** — *Settings* → *Domains* → add e.g. `ashanmotors.co.ke` and follow the DNS instructions.

Every push to `main` redeploys automatically.

Limits to know: each upload request is capped at 4.5 MB by Vercel, so the admin page resizes photos and uploads them one by one; sign-in tokens last 8 hours and changing `ADMIN_PASSWORD` or `SESSION_SECRET` signs everyone out.

Pages:

| URL | Page |
| --- | --- |
| `/` | Home: banner, search panel, handpicked cars, new arrivals, browse by price/year/type, category rows, FAQ, socials |
| `/stock` | Stock list with filters (filters are kept in the URL, e.g. `/stock?body=SUV&maxPrice=5000000`) |
| `/cars/<id>` | One page per car, shareable on WhatsApp / Instagram / TikTok |
| `/admin` | Staff stockroom (link: **Staff sign in** in the footer). Local development password is `ashan-demo-2026`; the live site uses `ADMIN_PASSWORD`. |

FAQ answers and the "about" text in the footer are in `site-config.ts` (see below).

## Business details and social links

Edit [client/src/app/site-config.ts](client/src/app/site-config.ts): WhatsApp number (digits only, e.g. `254712345678`), phone, email, location, opening hours, and the Instagram, TikTok and YouTube URLs. Any social link left as `''` is hidden.

Brand colours are the tokens at the top of [client/src/styles.scss](client/src/styles.scss) (`--gold`, `--night`, …). The logo is [client/public/logo.png](client/public/logo.png).

## Server settings (environment variables)

| Variable | Purpose | Default |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. When empty, data is kept in a JSON file instead. | — |
| `DATABASE_SSL` | `true` for hosted databases that require SSL (automatic when the URL contains `sslmode=require`) | `false` |
| `ADMIN_PASSWORD` | Admin sign-in password. **Required in production.** | `ashan-demo-2026` (dev only) |
| `SESSION_SECRET` | Secret used to sign admin sign-in tokens | built-in (set it in production) |
| `SEED_SAMPLE_DATA` | `false` to start a new database without the sample cars | `true` |
| `CLIENT_ORIGIN` | Only needed if the site and API are on different domains | `http://localhost:4200` |
| `INVENTORY_FILE` | JSON storage file (only when `DATABASE_URL` is empty) | `server/data/inventory.json` |
| `UPLOADS_DIR` | Photo folder (only when `DATABASE_URL` is empty) | `server/uploads` |
| `PORT` | API port | `3000` |

## Data storage (PostgreSQL)

With `DATABASE_URL` set, everything is stored in PostgreSQL. The tables are created automatically on first start (see `server/src/inventory.store.ts`):

| Table | Holds |
| --- | --- |
| `cars` | Every listing: make, model, year, price, mileage, specs, description, status, `new_arrival`, collection, photo links |
| `photos` | Uploaded photo files themselves (`bytea`), served at `/api/photos/<id>` |
| `collections` | Collection names |

On the first start against an empty database, existing cars from `server/data/inventory.json` are imported automatically.

Photos are resized in the admin's browser to at most 1600px (JPEG) before upload, so a typical photo is 200–400 KB.

**Going live:** create a PostgreSQL database with any provider (Neon, Supabase, Render, Railway, DigitalOcean, or your own server), then set `DATABASE_URL` to its connection string and `DATABASE_SSL=true` if the provider requires SSL.

Useful commands with the local Docker database:

```bash
docker exec -it ashan-postgres psql -U ashan -d ashan_motors                 # SQL console
docker exec ashan-postgres pg_dump -U ashan ashan_motors > backup.sql          # backup
```

Without `DATABASE_URL`, the server falls back to a JSON file and a local `uploads` folder, which is handy for quick local testing.

## Adding new arrivals (admin)

1. Footer → **Staff sign in** → enter the admin password.
2. **+ Add a car**, fill in the details, upload photos (the first is the cover).
3. Leave **Show in New Arrivals** ticked (it is on by default) and click **Add to showroom**.

The car immediately appears in the home page banner, "Latest additions", and **Stock list → New arrivals**. To take a car out of New Arrivals later, click **Remove from New** in the inventory table (or **★ Mark as New** to put one back). Sold cars are never shown as new.
