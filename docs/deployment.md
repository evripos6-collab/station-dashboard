# Deployment

Two artifacts deploy independently: the Worker and the static site. The Worker
should be live and verified first, since the site is useless without it.

## Worker

From `worker/`:

```bash
npx wrangler deploy
```

Requires Node 18 or newer and a Cloudflare account. `npx wrangler login` once,
`npx wrangler whoami` to confirm. The first deploy on a new account asks you to
choose a `workers.dev` subdomain; that choice is permanent and account-wide.

The deployed URL is `https://<name>.<subdomain>.workers.dev`, where `<name>` is
the `name` field in `wrangler.toml`.

### The API token

```bash
npx wrangler secret put SATNOGS_API_TOKEN
```

Prompts for the value, stores it as a Worker secret. It never touches the
repository or the browser. Optional, but without it the Network rate limit is
60 requests an hour rather than 240.

If a token is ever committed, rotate it. Removing the commit is not enough.

### ALLOWED_ORIGINS

`ALLOWED_ORIGINS` in `worker/worker.js` starts with only `localhost:3000` and
`127.0.0.1:3000`. **After the site has a public domain, add it and redeploy the
Worker.**

```js
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://station-dashboard.pages.dev",
];
```

This is the step that is easy to miss, and its symptom is misleading: the page
loads, the globe renders, and every API call fails with 403.

Origins are matched exactly, including scheme and port. A custom domain is a
separate entry from the `pages.dev` one.

## Site

The site is static files. Whatever hosts it must serve `site/` as the document
root.

### Cloudflare Pages

The intended target, since the Worker is already on Cloudflare.

1. Workers & Pages → Create → Pages → Connect to Git, and authorise the GitHub
   account that owns the repository
2. Framework preset: None. Build command: empty. **Build output directory:
   `site`**
3. Deploy; note the `<project>.pages.dev` domain
4. Add that domain to `ALLOWED_ORIGINS` and redeploy the Worker
5. Verify from the real origin:

```bash
curl -si -H 'Origin: https://<project>.pages.dev' \
  "https://<worker>.workers.dev/api/observations/?ground_station=4755" \
  | grep -i access-control-allow-origin
```

Subsequent pushes to the default branch redeploy automatically.

### GitHub Pages

Also workable, at the cost of splitting the project across two providers.

The branch-based source only offers `/` or `/docs` as the publishing directory,
neither of which is `site/`. Use GitHub Actions as the Pages source instead,
which publishes whichever path the workflow uploads:

```yaml
name: pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: site
      - id: deployment
        uses: actions/deploy-pages@v4
```

Set Settings → Pages → Source to GitHub Actions. The resulting origin is
`https://<owner>.github.io`, and note that the path is `/<repo>/` while the
origin is the bare domain. It is the origin that goes in `ALLOWED_ORIGINS`.

## Branching

Two people on one small codebase will conflict on direct pushes to `main`.
Work on branches and merge by pull request; protect `main` with a ruleset
requiring a pull request. With only two contributors, requiring an approving
review is probably more friction than it is worth — requiring the pull request
is the useful part.

Splitting by directory keeps the two workstreams off each other's files:
`worker/` and `site/`. A `CODEOWNERS` file makes that explicit and
auto-requests the right reviewer.

## Before the first push

- `.gitignore` covers `.env`, `.dev.vars`, `*.token`, `node_modules/` and
  `.wrangler/`
- `wrangler.toml` holds no secrets, so it is committed
- no API token anywhere in the tree:

```bash
git grep -nEi 'token|secret' -- . ':!docs' ':!README.md'
```

Expect hits only on the token's *name* in `worker.js` and the config comments,
never a value.
