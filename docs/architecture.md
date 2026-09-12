# Architecture

```
browser  ──►  Cloudflare Worker  ──►  network.satnogs.org
   │            (CORS proxy,              (SatNOGS Network API)
   │             60 s edge cache)
   └─► Cesium globe, CZML built client-side
```

The page fetches station records and observations, propagates a ground track
for each pass, assembles a CZML document in memory, and hands it to Cesium.
There is no server of ours in the request path other than the proxy, and no
build step.

## Why the Worker exists

`network.satnogs.org` sends no `Access-Control-Allow-Origin` header. CORS is
enforced by the browser, not the server: page JavaScript can issue the request
but is not allowed to read the response unless the server names the origin.
This cannot be worked around from the client.

The Worker fetches server-side and re-emits the response with the header
attached. That is all it does. It is deliberately not a general proxy:

- only `network.satnogs.org`, only `/api/` paths, only GET, HEAD and OPTIONS
- only origins on its `ALLOWED_ORIGINS` list

Without those limits anyone who finds the URL can route traffic through the
account and exhaust the free quota.

A better long-term fix is for the CORS header to be added upstream, which would
help everyone building browser tooling on Network. Worth raising on the
community forum, but not worth blocking on.

### Two details that are easy to lose

**`Access-Control-Expose-Headers: Link`.** Network uses cursor pagination and
the next-page cursor lives in the `Link` header. Browsers hide that header from
JavaScript unless it is explicitly exposed. Without it the page fetches one
page and never finds the second.

**The `Link` URLs are rewritten.** They come back pointing at
`network.satnogs.org`, which the browser cannot read. The Worker repoints them
at itself so the client can follow `rel="next"` verbatim, query filters intact.

### Secrets and quota

`SATNOGS_API_TOKEN` is a Worker secret and never appears in client code or in
this repository. It raises the Network rate limit from 60 to 240 requests an
hour, which matters because every cursor page is a request.

Responses are cached at the edge for 60 seconds, so a room full of people
scanning a QR code produces a handful of upstream requests rather than one per
viewer. Cloudflare's free tier allows 100,000 Worker requests a day, 10 ms CPU
per invocation and 50 subrequests per request. Pages static assets are
unmetered, but any Pages Function would count against the Worker quota.

## API specifics

### Pagination

`/api/observations/` returns a bare JSON array, not an object with `results`
and `next`. The cursor is in the `Link` header. Page size is 25.

Code that reads `next` from the response body will silently stop after the
first page, which looks exactly like a station that has few observations. The
client walks `rel="next"` until the header is absent, and raises an error
rather than truncating if the walk exceeds 50 pages.

### Observation status

`vetted_status` no longer exists. Use `status`, with the same vocabulary:
`good`, `bad`, `unknown`, `failed`, `future`.

### Station status

Network 1.128 deprecated the single `status` string. It is derived, and it
collapses to `Offline` whenever `is_available` is false, which cannot
distinguish a client that stopped talking from an owner who took the station
down deliberately.

| `status` | `is_connected` | `is_available` | `testing` |
|---|---|---|---|
| Online | true | true | false |
| Offline | false | any | any |
| Offline | any | **false** | any |
| Testing | true | true | true |

The dashboard uses the three flags directly and shows them separately in the
station popup. The derived state drives the chip colour:

| State | Meaning | Colour |
|---|---|---|
| `offline` | not connected — the client has stopped talking | red |
| `unavailable` | connected, but the owner has marked it unavailable | grey |
| `testing` | connected, available, in testing | orange |
| `online` | connected and available | green |

Priority runs in that order, so a disconnected station reads as offline
regardless of the other flags.

### Why `/api/observations/` and not `/api/jobs/`

The observations endpoint returns `tle0`/`tle1`/`tle2`, `sat_id`,
`transmitter_uuid`, `transmitter_description`, `status` and the station id in
the same record, so no satnogs-db lookups are needed. It can be filtered with
`ground_station`, and `start__lt` / `end__gt` together form an overlap test, so
a pass already under way is included rather than dropped.

## Client modules

| Module | Job |
|---|---|
| `config.js` | URL query parameters and defaults |
| `api.js` | fetching and cursor pagination |
| `orbit.js` | SGP4 propagation and ground-track sampling |
| `czml.js` | CZML document and sidebar table |
| `icons.js` | inline SVG data URIs for the two glyphs |
| `links.js` | station-to-satellite line styling and animation |
| `markdown.js` | Markdown subset for station descriptions |
| `viewer.js` | Cesium viewer, sky, imagery, camera |
| `panel.js` | sidebar rendering and clock-driven row state |
| `splash.js` | loading screen |
| `main.js` | refresh loop tying the above together |

## Design notes

**Colours are CZML interval properties, not fixed values.** The running
highlight therefore flips on the Cesium clock rather than on a data refresh,
which is why the page still looks live between fetches and why scrubbing the
timeline moves the highlight with it.

**Propagation.** The Python original used Skyfield; the browser uses
satellite.js. Compared over a ten-minute LEO pass from an identical TLE, the
two agree to 34 m horizontally and 0.4 m vertically. The difference is
irrelevant at globe scale.

**No Cesium ion token.** Imagery comes from Esri, and no ion asset is used, so
`Ion.defaultAccessToken` is left unset and nothing is sent to Cesium. If ion
terrain or assets are added later, the token is public by design but should be
domain-restricted to the Pages domain.

**Imagery picking is disabled.** Otherwise every click on the globe runs an
ArcGIS Identify query and opens the info box on an administrative polygon.
Entities remain pickable.

**satellite.js arrives from a CDN** through the import map in `index.html`. One
line to change if you vendor it into `site/vendor/`, which is worth doing
before this is relied on for a public demonstration.

**The local Flask app stays as it is.** It remains the real-time version run at
home; this is a second artifact for sharing, not a replacement.
