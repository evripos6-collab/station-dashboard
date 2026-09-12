# station-dashboard

A static 3D dashboard for three SatNOGS ground stations: a Cesium globe showing
the stations, their recent and upcoming observations, and the ground track of
each pass.

| Station | Band | Site |
|---|---|---|
| 4755 | UHF | NKUA Evripos campus |
| 5026 | VHF | NKUA Evripos campus |
| 4791 | UHF | Meganisi |

The page is plain HTML and ES modules with no build step. It reads the SatNOGS
Network API through a small Cloudflare Worker and builds its CZML in the
browser. Nothing here writes to SatNOGS; it is read-only throughout.

## Repository layout

```
site/          the dashboard: index.html, js modules, dev harnesses
worker/        the Cloudflare Worker CORS proxy
docs/          architecture, configuration, development, deployment
```

## Quick start

```bash
cd site
python3 -m http.server 3000
```

Then open http://localhost:3000/. Port 3000 is not arbitrary: it is the origin
the deployed Worker allows. See [docs/development.md](docs/development.md).

## Documentation

- [Architecture](docs/architecture.md) — how the pieces fit, and why the Worker exists
- [Configuration](docs/configuration.md) — stations, time window, camera, endpoints
- [Development](docs/development.md) — running locally and the verification harnesses
- [Deployment](docs/deployment.md) — publishing the Worker and the page

## Credits

The original dashboard is a rewrite of KD9KCK's `satnogsmap`, rebuilt entirely
on the SatNOGS Network observations endpoint.

Alex Gavrilis ([@alexandrosgavrilis](https://github.com/alexandrosgavrilis)) and
Thodoris ([@thodoriskf](https://github.com/thodoriskf)) — authors and station
operators.

[Libre Space Foundation](https://libre.space/) for SatNOGS, the network and the
software the stations run on.

Built with [CesiumJS](https://cesium.com/platform/cesiumjs/) and
[satellite.js](https://github.com/shashwatak/satellite-js). Imagery from Esri
World Imagery, falling back to OpenStreetMap.

#### AI - Usage
We make no effort to disguise the usage of generative AI tools to assist in the development of this project. It is our view that when performed to aid rather than drive the development, it is a powerful tool capable of increasing our productivity and output pace by an order of a magnitude.

For the completion of this dashboard we hereby declare we used Claude (Anthropic) to: 
- Assist with the design parameters and implementation of this static port from our locally hosted SatNOGS-UHF PC to the Cloudflare + Github arrangement.
- Assist with translation of the code from Cesium to the JS setup.
- Author the current documentation and make configuration changes under our supervision.



Thank you for your curiosity in investigating this here repo.
