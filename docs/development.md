# Development

No build step, no package manager, no dependencies to install. The modules are
plain ES modules and the browser loads them directly.

## Running locally

```bash
cd site
python3 -m http.server 3000
```

http://localhost:3000/

Serve from `site/`, not the repository root. `index.html` loads `js/main.js` as
a relative path, and rooting the server higher would also publish `worker/`
over HTTP.

ES modules will not load over `file://`. The page has to come off an HTTP
server.

### Why port 3000

`http://localhost:3000` and `http://127.0.0.1:3000` are the origins in the
Worker's `ALLOWED_ORIGINS`. Anything else gets a 403 from the proxy. This is
deliberate: local development runs against the real deployed proxy, so there is
no mock layer that can drift from production behaviour.

The local Flask dashboard also wants port 3000. Stop it first, or run it
elsewhere with `PORT=3001`.

### Caching while editing

Modules are aggressively cached. Keep DevTools open with "Disable cache"
ticked, or hard-reload after each change. A stale module whose dependents
expect a newer version produces confusing failures rather than obvious ones.

## Verification harnesses

Three pages under `site/dev/` exercise the layers bottom-up. Each is standalone
and prints what it finds. They are the fastest way to tell which layer broke.

| Page | Checks |
|---|---|
| `dev/fetch-check.html` | API layer: per-station observation counts, station flags, status breakdown, TLE presence |
| `dev/track-check.html` | Propagation: sample counts against pass length, height sanity, timing |
| `dev/czml-check.html` | CZML: packet counts by kind, derived station state, clock window, downloads `czml.json` and `table.json` |

They accept the same query parameters as the dashboard, so
`dev/fetch-check.html?stations=4791:UHF` narrows a check to one station.

`fetch-check` is the one to run first when something looks wrong. If 4755
reports exactly 25 observations, pagination has regressed.

These pages deploy along with the site. That is harmless — they are read-only
and hold no secrets — but they are public.

## Diffing against the Flask app

`dev/czml-check.html` downloads the CZML it built. To compare against the
original:

```bash
PORT=3001 SATNOGS_STATIONS="4755:UHF,4791:UHF,5026:VHF" python3 satnogs_dashboard.py
curl -s http://127.0.0.1:3001/czml > flask-czml.json
```

Expect two differences by design: the station packet descriptions, which now
carry the three status flags and rendered Markdown, and the label `fillColor`,
which is `{"rgba": [...]}` here rather than a bare array. The Python emits the
array, which is not valid CZML and which Cesium silently ignores in favour of
white.

The observation sets will also differ if the Flask app has not been fixed to
follow the `Link` header.

## Testing the Worker

```bash
W=https://satnogs-cors-proxy.nkuasatnogs.workers.dev

# allowlisted origin: CORS headers, exposed Link, Link pointing back at $W
curl -si -H 'Origin: http://localhost:3000' \
  "$W/api/observations/?ground_station=4755" | grep -iE '^(HTTP|link|access-control)'

# non-allowlisted origin
curl -si -H 'Origin: https://evil.example' "$W/api/observations/" | head -1   # 403

# preflight
curl -si -X OPTIONS -H 'Origin: http://localhost:3000' "$W/api/observations/" | head -1   # 204

# path restriction
curl -si -H 'Origin: http://localhost:3000' "$W/admin" | head -1   # 404
```

Run the Worker locally with `npx wrangler dev` from `worker/`, and point the
page at it with `?proxy=http://localhost:8787`. Add that origin to
`ALLOWED_ORIGINS` first, or the local Worker will refuse the local page.

## Conventions

Small modules with one job each. Comments explain why, not what, and anything
needing three paragraphs belongs here rather than in a source comment. No
attribution in source files; credits live in the README.
