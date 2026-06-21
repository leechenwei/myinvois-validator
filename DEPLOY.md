# Deploy cheat-sheet (static site, RM0)

Run everything from inside the `einvoice-validator/` folder.

## A) Vercel CLI (fastest — live in ~1 min)

```bash
vercel logout                 # drop the insidedeveloper888 account
vercel login                  # pick leechenwei (GitHub) or LuisLCW02@gmail.com (email)
vercel whoami                 # confirm it's the right account

cd einvoice-validator
vercel deploy --prod          # first run: accept defaults, "other"/no framework, root = .
```

It prints a `https://<name>.vercel.app` URL. That's live.

## B) GitHub Pages (no Vercel needed)

```bash
gh auth switch --user leechenwei         # already done this session
cd einvoice-validator
git init && git add . && git commit -m "MyInvois e-invoice JSON validator"
gh repo create myinvois-validator --public --source=. --push
# then: GitHub repo → Settings → Pages → Branch: main / root → Save
```

URL: `https://leechenwei.github.io/myinvois-validator/`

## After it's live — DO THESE or it won't earn

1. **Set the real URL** in `index.html`: replace `https://example.com/` in the
   `<link rel="canonical">` and the two `og:` tags with your live URL. Redeploy.
2. **Submit to Google** (this is what makes it rank — without it Google may never find it):
   - Go to Google Search Console → add your URL as a property → verify.
   - "URL Inspection" → paste your URL → "Request indexing".
3. **Custom domain (optional, ranks better):** buy a cheap `.my`/`.com`, add it in
   Vercel → Domains, point DNS. Update canonical/og URLs again.
4. **Check it works:** open the live URL, click "Load example" → you should see the
   red/amber findings. Confirm on your phone too (Google ranks mobile first).

## Updating later

- Vercel: `vercel deploy --prod` again.
- Pages: `git commit -am "..." && git push`.
- Quarterly: re-check `validator.js` rules against any new LHDN schema version.
