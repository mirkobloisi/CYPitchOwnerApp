# MYPitch Pitch Owner — Website Deployment

The website is not a separate project. It is this same Expo app, exported for
the browser, using the same Supabase database and the same pitch owner logins.
One codebase, two places it runs.

**Hosted on Vercel** (moved from Netlify — see "Removing the old Netlify site"
below if you haven't already deleted it).

---

## Before deploying: build the site

In the `MYPitchOwnerApp` folder:

```
npx expo export --platform web
```

This creates a `dist` folder containing the finished website. It takes a minute
or two. Run this again any time you want to publish new changes.

**Where the Supabase keys come from:** `expo export` reads your local `.env` and
bakes those two `EXPO_PUBLIC_` values into the built files. So your `.env` must
be present and correct when you run this command — nothing needs to be
configured separately in Vercel.

Only the publishable key is used. Never put the service-role key in `.env` for
a web build; it would be readable by anyone who visits the site.

---

## One-time setup: link the project to Vercel

Do this once, from the `MYPitchOwnerApp` folder — **not** from inside `dist`
(that folder gets deleted and rebuilt every time you export, so anything
stored inside it would be lost).

```
npm install -g vercel
vercel login
vercel link
```

- `vercel login` opens your browser to sign in (or create a free account).
- `vercel link` asks which team/scope and what to name the project — use
  something like `mypitch-owner`. This writes a `.vercel` folder in the
  project root that remembers which Vercel project this is. It's excluded
  from git and safe to leave in place.

This only needs to happen once. Every deploy after this reuses that link, so
you always publish to the same URL instead of creating a new site each time.

---

## Every time you want to publish changes

```
npx expo export --platform web
Copy-Item -Recurse -Force .vercel dist\.vercel
vercel deploy --prod dist
```

(On macOS/Linux, the middle line is `cp -R .vercel dist/.vercel` instead.)

The first command rebuilds `dist` — which wipes and recreates the folder from
scratch, including deleting any `.vercel` link inside it. The Vercel CLI looks
for that link *inside whichever folder you tell it to deploy*, not in the
folder you ran `vercel link` from — so the middle command copies the link back
in before every deploy. Skip it and the CLI will ask "Which project?" again
instead of reusing the one you linked (if that happens, just pick **Search all
projects** and select your project by name — it won't create a duplicate, but
it's an extra step worth avoiding).

The very first successful deploy will print your live URL — currently
`https://mypitch-owner-app.vercel.app`. You can rename the project any time
from the Vercel dashboard (**Project → Settings → General → Project Name**),
but remember to update Supabase's URL Configuration (next section) to match
whenever you do — a rename alone doesn't update that.

---

## After the site is live: point Supabase at it

Supabase needs to know the site's address so password-reset and confirmation
emails link to the right place.

Supabase dashboard → **Authentication → URL Configuration** → set **Site URL**
to your Vercel address, and add it under **Redirect URLs**. If you were
previously pointing this at the Netlify address, replace it — don't just add
to it, or password reset links could resolve to a dead site.

---

## Removing the old Netlify site

Now that the Owner app website lives on Vercel, you can take down the old
`mypitch-owner.netlify.app` deployment:

1. Log into **app.netlify.com**.
2. Open the **mypitch-owner** site.
3. **Site configuration → General** → scroll to the **Danger zone**.
4. **Delete this site** → confirm.

This is permanent — the old URL stops resolving immediately. Do this only
after confirming the Vercel site works and Supabase's URL Configuration has
been updated to point at it (previous section), so nothing is left half-wired
to the old address.

---

## Later: a custom domain

The `.vercel.app` address is free forever and fine to launch with. If you
later want `mypitch.com` or `owner.mypitch.com`:

- Genuinely free custom domains have largely disappeared since Freenom stopped
  issuing them. [EU.org](https://nic.eu.org/) still gives free domains that
  never expire (`mypitch.eu.org`), but requests are reviewed by volunteers and
  can take weeks.
- A real domain costs roughly €10/year from Namecheap, Porkbun or Cloudflare
  Registrar.

To connect one: `vercel domains add yourdomain.com` from the project folder
(or **Project → Settings → Domains** in the dashboard), then at your registrar
add whatever DNS records Vercel gives you. DNS usually applies within an hour;
Vercel issues the HTTPS certificate automatically once it resolves.

Remember to update the Supabase URL Configuration again if the address changes.

---

## Files that make this work

- `public/vercel.json` — sends every route to `index.html` (so a refresh on
  `/agenda` works) and sets the same security headers, in the format Vercel
  actually reads. **This is the one that matters on Vercel.**
- `public/_redirects` / `public/_headers` — the Netlify-syntax equivalents,
  left over from when the site was on Netlify. Vercel does **not** read
  these for a plain `vercel deploy` of a static folder — despite what an
  earlier version of this doc claimed. That mismatch is exactly what broke
  the live site once (every route, including `/`, came back as a real
  Vercel 404 instead of the app). Harmless to leave in place since nothing
  reads them anymore, or delete them if you want to tidy up.
- `app.json` → `web.output: "single"` — builds one page resolved in the browser,
  rather than pre-rendering routes in Node (which breaks on browser-only APIs).
- `.vercel/` (created by `vercel link`) — remembers which Vercel project this
  folder deploys to. Don't delete it or you'll need to re-link.
- `netlify.toml` — no longer used now that the site is on Vercel; harmless to
  leave in place, or delete it if you want to tidy up.
