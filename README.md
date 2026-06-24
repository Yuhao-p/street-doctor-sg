# Street Doctor SG

A civic **street-audit platform** for Singapore: residents map long-term, design-level street
problems — missing footpaths, unsafe crossings, accessibility barriers — and the evidence is
structured for the Singapore Transport Collective (STC) to advocate with LTA and other agencies.

Static front-end (HTML/CSS/vanilla JS) on a **shared Supabase backend**, so reports, comments,
votes and flags are visible to everyone. Bilingual (English / 简体中文) and mobile-first.

**Live:** https://yuhao-p.github.io/street-doctor-sg/ (GitHub Pages)

## How it works

- **Accounts** — everyone registers (Supabase email/password). Reading is public; reporting,
  commenting, supporting and flagging require logging in. A **forgot-password** flow is included.
- **Report → published immediately** — there's no moderation gate. A new report goes straight onto
  the public map.
- **Community flagging** — anyone can flag a case that's wrong or doesn't belong (not real, wrong
  location, duplicate, offensive/spam). Moderators only handle the resulting flags: keep the case
  (dismiss) or remove it.
- **Discussion** — each case has a public comment thread.
- **Support / co-sign** — one support per account, deduped in the database; the report flow also
  suggests existing cases on the same road/spot so people join those instead of duplicating.
- **Moderation** — users with `profiles.role = 'moderator'` get the `/admin` console: case list,
  flag queue, status lifecycle, edit/remove, duplicate detection, CSV/GeoJSON export.

## Map features

- MapLibre map (CARTO Voyager basemap, no key) with category + status filters and colored markers.
- **One-tap "Locate me"** flies to the user's GPS position (and drops the report pin while reporting).
- **Road-segment selection** — hover/click a pre-built junction-to-junction road network
  (`data/sg-roads.geojson`, ~64k segments) to attach the affected stretch; live Overpass lookup is
  the fallback outside the pre-built area.
- **Transit-stop layer** — a toggleable curated MRT/LRT layer ([`js/transit.js`](js/transit.js));
  click a station to report about it.
- **Mobile UX** — the filter panel collapses behind a "Filters" button; the report sheet is a
  draggable bottom sheet (snaps to 25% / 55% / 90%) so users choose how much map to see.

## Run / develop locally

Serve the folder (the app talks to the live Supabase backend, so you'll see shared data):

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

Geolocation, clipboard and auth work over `http(s)://`, not `file://`.

## Set up your own Supabase backend

1. Create a Supabase project. Put its **Project URL** + **publishable (anon) key** in
   [`js/supabase.js`](js/supabase.js). (The anon key is safe in the browser — access is governed by
   Row Level Security, not by hiding the key. Never embed the `service_role` key.)
2. In the SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql) — it creates the tables, RLS
   policies, and triggers (`support_count` sync and the initial published-history row both run
   `security definer` so non-moderators can report and vote).
3. **Authentication → Providers → Email**: enable it. For dev, turn **Confirm email** off so signup
   logs you straight in (turn it back on before any real launch). The built-in email service is
   rate-limited — for real delivery, wire up your own SMTP: see [docs/smtp-resend.md](docs/smtp-resend.md).
4. **Authentication → URL Configuration**: add your site URL to **Site URL** and **Redirect URLs**
   (e.g. `https://yuhao-p.github.io/street-doctor-sg/`) so the password-reset email links return correctly.
5. Make yourself a moderator after signing up:
   ```sql
   update public.profiles set role = 'moderator'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

## Files

```
index.html               app shell + CDN scripts (MapLibre, supabase-js)
css/styles.css           mobile-first styles
js/i18n.js               EN / 简体中文 dictionary + render-time DOM translation
js/supabase.js           Supabase client + auth session (Session / Auth)
js/data.js               constants + DB: Supabase-backed in-memory cache
                         (categories & site settings stay in localStorage)
js/transit.js            curated MRT/LRT station list
js/app.js                hash router + all views (public + admin)
data/sg-roads.geojson    full-island junction-to-junction road network
data/pilot-roads.geojson Toa Payoh pilot network
scripts/build-roads*.mjs road-network generators (Overpass)
supabase/schema.sql      Postgres schema, RLS policies, triggers
```

`DB` in [`js/data.js`](js/data.js) is the single data-access layer: reads are synchronous from an
in-memory cache hydrated from Supabase on startup; writes are optimistic and persisted in the
background (note: a Supabase query only runs when it's awaited/`.then()`'d).

## Known prototype shortcuts

- **Photos** are stored as data URLs on the issue row — fine for a prototype; move to Supabase
  Storage for production.
- **Categories & site settings** are still client-side (localStorage), so admin edits and any
  added categories aren't shared between users yet.
- **Bilingual scope**: the public site is translated; the `/admin` console and user-written content
  (titles, descriptions, comments) stay as authored. The four prose pages
  (About/FAQ/Privacy/Terms) are not translated yet.
- **Basemap** is CARTO instead of OneMap; **Turnstile** is a checkbox placeholder; default
  Supabase email is rate-limited (swap in your own SMTP for volume).
