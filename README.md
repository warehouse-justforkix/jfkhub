# JFK Warehouse Hub

Internal site for the Just For Kix warehouse team (3 full-time + 3 part-time), with real accounts.

## Features

- **Accounts & invites** — admins add an email in the Admin panel; that person opens the site,
  hits "Create account" with the invited email, and sets up a profile (name, FT/PT, weekly hours).
  Un-invited emails can create an auth account but get no data access.
- **Time Clock** — four punches per day (clock in / out to lunch / back from lunch / clock out) with
  an undo. Members see their own punches; admins get a "Who's in" table for any day.
- **Announcements** — team-wide feed; anyone posts, author or admin deletes.
- **Task Boards** — two boards behind tabs: **Warehouse** (all members) and **Customer Support**
  (only members granted `support_access`, plus admins — enforced by RLS, not just hidden in the UI).
  Each has Up for grabs / Claimed / Done columns; claim under your own profile; recurring tasks
  (daily / weekdays / weekly / monthly) re-post the next occurrence on completion.
- **Calendar** — month view of time off, changed hours, and meetings; click a day to add an entry;
  "Today" callout at the top of the page; upcoming list below.
- **Schedules (private)** — standing weekly hours live in `member_hours`, readable only by the
  member themself and admins. Members see just their own row; admins see the full grid.
- **Messages** — member ↔ admin threads only (no member-to-member). Admins get a per-member
  conversation picker.

## Stack

Static site (no build step): `index.html` + `style.css` + `app.js`, talking straight to Supabase
via `@supabase/supabase-js` (ESM from esm.sh). Supabase Auth (email + password; disable "Confirm
email" for frictionless signup). All authorization enforced by row-level security; the admin flag
is copied from `invited_emails` by a trigger and can't be set by clients.

- `config.js` — Supabase URL + anon key (placeholders until the project is created)
- `db/setup.sql` — one-time schema, triggers, RLS policies, admin seed (karley@justforkix.com)
- Hosting: Vercel (deployed via the claude.ai Vercel connector)

## Local preview

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

(Needs a server because app.js is an ES module; file:// won't work.)
