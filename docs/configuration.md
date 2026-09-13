# Configuration

Everything configurable lives in `site/js/config.js`, as a `DEFAULTS` object and
a matching URL query parameter. The defaults are what a bare link shows; the
query parameter overrides the default for that one link, without a redeploy.

```
https://<pages-domain>/?stations=4755:UHF&past=6&pitch=-30
```

## Stations

The station list is `id:BAND` pairs, comma separated. Order controls the order
of the header chips.

```
stations=4755:UHF,4791:UHF,5026:VHF
```

### Turning a station off

**For one link**, drop it from the query parameter. To show only the two NKUA
stations and leave stations owned by PMs out:

```
https://<pages-domain>/?stations=4755:UHF,5026:VHF
```

The bare URL still shows all three, so this is the right tool for a link you
send someone, a QR code for a specific display, or a quick check.

**For everyone**, edit `DEFAULTS.stations` in `site/js/config.js`:

```js
const DEFAULTS = {
  stations: "4755:UHF,5026:VHF",
  ...
};
```

Commit and redeploy. Nothing else needs to change. The dashboard fetches only
the stations it is told about, so a removed station costs no requests, gets no
chip, and contributes no observations or ground tracks. The camera reframes
itself around whatever stations remain, and the page title is built from their
Network names.

Nothing needs changing in the Worker. It proxies the Network API in general and
has no knowledge of which stations are being displayed.

### The band suffix

The band in `id:BAND` serves two purposes: it labels the chip, and it is
appended to the station's Network name when that name doesn't already say which
band the station is. `NKUA EVRIPOS - UHF` already contains `UHF`, so nothing is
appended. `MEGANISI_1` does not, so it renders as `MEGANISI_1 · UHF`. The match
is case-insensitive and on word boundaries.

Give a station as a bare id (`4791`) to opt out of the suffix entirely.

## Time window

| Parameter | Default | Meaning |
|---|---|---|
| `past` | 2 | Hours of finished observations to include |
| `future` | 12 | Hours of scheduled observations to include |
| `refresh` | 5 | Minutes between refreshes |
| `idle` | 120 | Minutes without interaction before refreshing pauses; 0 disables pausing |

The Cesium clock window is the data window plus an hour at each end.

These defaults are also the main lever on Worker usage. Each refresh costs one
request per station plus one per page of observations, and a page holds 25. A
window that keeps every station under 25 observations costs the minimum of two
requests per station per refresh; widening `future` past that point adds a page
for the busiest station first. `refresh` is the blunter lever: doubling it
halves everything.

Observations are selected by overlap, not by start time, so a pass already
under way when the page loads is included.

The window bounds sent to the API are floored to a five-minute grid. Every
viewer in the same slot therefore requests an identical URL, which is what lets
the Worker's cache serve them from a single upstream request. Without it each
viewer's URL is unique and upstream load scales with the audience.

A hidden tab does not refresh at all, and refreshing pauses after `idle`
minutes without interaction. The age line then reads "paused, tap to resume",
and any click, key or scroll resumes it with an immediate refresh. Set
`idle=0` for a wall display that should keep refreshing unattended.

## Ground tracks

| Parameter | Default | Meaning |
|---|---|---|
| `sample` | 15 | Seconds between sub-satellite samples |

Lower means smoother tracks and more work per pass. At the default, a
ten-minute pass is about forty points.

## Camera

| Parameter | Default | Meaning |
|---|---|---|
| `pitch` | -40 | Camera pitch in degrees; -90 is straight down, 0 is the horizon |
| `range` | auto | Camera distance from the stations in metres |

Left unset, `range` is 3,000 km for several stations and 3,600 km for one.

## Endpoints

| Parameter | Default | Meaning |
|---|---|---|
| `proxy` | the deployed Worker | CORS proxy for the Network API |
| `network` | `https://network.satnogs.org` | Used only to build observation links |

`proxy` is what a local development page points at a different Worker. The page
never talks to the Network API directly; see `architecture.md` for why.
