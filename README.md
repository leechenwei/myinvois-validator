# MyInvois e-Invoice JSON Validator

A free, 100% client-side tool that checks a Malaysian MyInvois e-invoice JSON file
against the LHDN Invoice v1.1 field spec and flags what the portal would reject —
**before** the user submits. No backend, no upload, no data collected.

- `index.html` — the page (SEO meta + FAQ schema + disclaimer + UI)
- `validator.js` — the ruleset (works in browser and Node)
- `validator.test.js` — `node validator.test.js` → runnable self-check (8 cases)

## Why this exists (the income thesis — honestly)

This is **not** a salary. It is a *lottery ticket with a real ticket*. The plan,
after an adversarial red-team:

1. **Distribution = Google, not you.** People in 2026 are forced into MyInvois,
   hit a cryptic JSON rejection, and search *"myinvois json validator"* / *"why is
   my e-invoice rejected"*. There is no dedicated free tool on that thin Malaysian
   long-tail (only EU/India validators + ERP vendors writing articles). If this page
   ranks, Google sends the visitors. **You never post, present, or market anything.**
2. **It compounds passively.** A correct, fast, single-purpose tool earns trust,
   links, and rank over months — zero ongoing effort beyond a quarterly check that
   LHDN hasn't bumped the schema.
3. **Then money gets wired in** (only after it shows ranking traction — don't build
   the paid part into a page nobody visits yet). Two clean options:
   - A one-time **Pro** unlock (batch-validate many files, save supplier/buyer TIN
     profiles, auto-fix RM→MYR) sold via **Lemon Squeezy / Paddle** (merchant-of-record:
     they handle global tax and pay out to a Malaysian bank — sidesteps the Stripe-MY
     cross-border snag the red-team found). Price RM39–59 one-time.
   - Ship the same validator as a **Chrome / VS Code extension**; the web page is the
     install-velocity seed the store ranking needs.

**Honest expectation:** modal outcome is RM0. Realistic good case: months 4–9 it
starts ranking → a trickle of visits → first RM40–250 once Pro exists → maybe
RM100–400/mo only if it crosses ~1,000 users. Treat it as cheap to ship, slow to pay.
The leverage is shipping *several* of these thin Malaysian-compliance tools once one
proves the channel.

## Deploy free (RM0)

Pure static — host anywhere free, no build step:

- **Cloudflare Pages / Vercel:** drag this folder into the dashboard, or
  `npx vercel deploy` from here. Free tier is plenty.
- **GitHub Pages:** push to a repo → Settings → Pages → deploy from branch.

A custom domain (~RM45/yr `.my`) ranks better than `*.vercel.app`, but start free.
Before publishing, set the real URL in `index.html` → `<link rel="canonical">` and
the `og:` tags.

## Compliance guardrails (why this is lawsuit-safe)

- **No personal data, ever.** Validation runs in the browser; the JSON never leaves
  the device. → **no PDPA duties, no breach exposure.**
- **Unofficial + non-affiliation + no-warranty** disclaimer is shown prominently.
  "MyInvois"/"LHDN" are used only *descriptively* (compatibility), never implying
  endorsement — legally-defensible nominative use.
- **Honest scope:** it states it does not replace the official portal or do signing.
- When income starts: declare it to LHDN as business income (Form B), keep records.

## What only YOU can do

1. Deploy it (above) and, optionally, point a cheap `.my` domain.
2. *Later, once it ranks:* open a free Lemon Squeezy/Paddle account to sell Pro.
3. Keep the right identity — you have two GitHub/Google accounts on this machine;
   pick the one that should own the project before pushing/publishing.
4. Nothing else. No marketing. That's the whole point.
