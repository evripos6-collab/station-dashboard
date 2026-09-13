import { iso } from "./api.js";
import { groundTrack, satelliteName } from "./orbit.js";
import { SAT_ICON, DISH_ICON } from "./icons.js";
import { LINK_DASH, LINK_COLOR } from "./links.js";
import { renderMarkdown } from "./markdown.js";

export const STATUS_COLORS = {
  future: [89, 167, 255, 255],
  good: [46, 229, 106, 255],
  bad: [255, 82, 82, 255],
  failed: [142, 152, 166, 255],
  unknown: [248, 163, 21, 255],
};

const RUNNING_COLOR = [255, 232, 77, 255];
const LABEL_COLOR = [232, 238, 246, 255];

// Network 1.128 deprecated the single status string: it collapses to Offline
// whenever is_available is false, which hides the difference between a client
// that stopped talking and an owner who took the station down deliberately.
export function stationState(station) {
  if (!station.is_connected) return { label: "offline", rgba: STATUS_COLORS.bad };
  if (!station.is_available) return { label: "unavailable", rgba: STATUS_COLORS.failed };
  if (station.testing) return { label: "testing", rgba: STATUS_COLORS.unknown };
  return { label: "online", rgba: STATUS_COLORS.good };
}

// The band suffix is for stations whose Network name doesn't say which band
// they are. NKUA's already do, and would otherwise read "... - UHF · UHF".
export function stationLabel(station, band) {
  const name = (station.name || `Station ${station.id}`).trim();
  const suffix = (band || "").trim();
  if (!suffix || suffix === "?") return name;
  const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`\\b${escaped}\\b`, "i").test(name)) return name;
  return `${name} \u00b7 ${suffix}`;
}

// Colours are intervals rather than fixed values so the running highlight
// flips on the Cesium clock instead of waiting for the next refresh.
function intervalColor(wStart, start, end, wEnd, idle) {
  const out = [];
  if (start > wStart) {
    out.push({ interval: `${iso(wStart)}/${iso(start)}`, rgba: idle });
  }
  out.push({
    interval: `${iso(new Date(Math.max(start, wStart)))}/${iso(new Date(Math.min(end, wEnd)))}`,
    rgba: RUNNING_COLOR,
  });
  if (wEnd > end) {
    out.push({ interval: `${iso(end)}/${iso(wEnd)}`, rgba: idle });
  }
  return out;
}

// FILL over a background pill. FILL_AND_OUTLINE with an outline width produces
// a speckled halo around the glyphs, a known Cesium SDF artifact.
function czmlLabel(text, fill, offsetX = 16) {
  return {
    text,
    font: "600 12px 'Chakra Petch', 'Helvetica Neue', Arial, sans-serif",
    style: "FILL",
    fillColor: Array.isArray(fill) && fill.length && typeof fill[0] === "object"
      ? fill
      : { rgba: fill },
    showBackground: true,
    backgroundColor: { rgba: [10, 15, 22, 200] },
    backgroundPadding: { cartesian2: [7, 4] },
    horizontalOrigin: "LEFT",
    verticalOrigin: "CENTER",
    pixelOffset: { cartesian2: [offsetX, 0] },
    disableDepthTestDistance: 1e7,
  };
}

// Stations at the same site would otherwise print their labels on top of each
// other; each additional one is lifted clear of the one before.
const LABEL_STACK_PX = 16;

function stationPacket(station, band, stackRow = 0) {
  const state = stationState(station);
  const label = stationLabel(station, band);
  const description =
    `<b>${station.name || ""}</b><br><b>ID:</b> ${station.id}<br>` +
    `<b>Band:</b> ${band}<br><b>Status:</b> ${state.label}<br>` +
    `<b>Connected:</b> ${station.is_connected} &middot; ` +
    `<b>Available:</b> ${station.is_available} &middot; ` +
    `<b>Testing:</b> ${station.testing}<br>` +
    `<b>QTH:</b> ${station.qthlocator || ""}<br>` +
    `<b>Observations:</b> ${station.observations ?? ""}<br>` +
    `<b>Success rate:</b> ${station.success_rate ?? ""}%<br>` +
    renderMarkdown(station.description);

  return {
    id: `station-${station.id}`,
    name: label,
    description,
    position: {
      cartographicDegrees: [station.lng, station.lat, station.altitude || 0],
    },
    billboard: {
      image: DISH_ICON,
      scale: 0.5,
      color: { rgba: state.rgba },
      verticalOrigin: "BOTTOM",
      disableDepthTestDistance: 1e7,
    },
    label: {
      ...czmlLabel(label, LABEL_COLOR, 14),
      verticalOrigin: "BOTTOM",
      pixelOffset: { cartesian2: [14, -6 - stackRow * LABEL_STACK_PX] },
    },
  };
}

export function buildCzml(stations, observations, config, now = new Date()) {
  const wStart = new Date(now.getTime() - (config.hoursPast + 1) * 3600e3);
  const wEnd = new Date(now.getTime() + (config.hoursFuture + 1) * 3600e3);

  const bands = new Map(stations.map(s => [s.id, s.band || "?"]));
  const names = new Map(stations.map(s => [s.id, s.name || s.id]));
  const title = stations.map(s => stationLabel(s, bands.get(s.id))).join(" / ");

  const czml = [{
    id: "document",
    name: title,
    version: "1.0",
    clock: {
      interval: `${iso(wStart)}/${iso(wEnd)}`,
      currentTime: iso(now),
      multiplier: 1,
      range: "CLAMPED",
      step: "SYSTEM_CLOCK",
    },
  }];

  const siteRows = new Map();
  for (const station of stations) {
    const site = `${station.lat.toFixed(2)},${station.lng.toFixed(2)}`;
    const row = siteRows.get(site) || 0;
    siteRows.set(site, row + 1);
    czml.push(stationPacket(station, bands.get(station.id) || "?", row));
  }

  const linkMaterial = config.linkStyle === "solid"
    ? { solidColor: { color: { rgba: LINK_COLOR } } }
    : { polylineDash: LINK_DASH };

  const table = [];
  for (const obs of observations) {
    if (!obs.tle1 || !obs.tle2) continue;

    const start = new Date(obs.start);
    const end = new Date(obs.end);
    const status = (obs.status || "unknown").toLowerCase();
    const idle = STATUS_COLORS[status] || STATUS_COLORS.unknown;
    const color = intervalColor(wStart, start, end, wEnd, idle);
    const interval = `${iso(start)}/${iso(end)}`;
    const id = String(obs.id);
    const name = satelliteName(obs);
    const gs = obs.ground_station;
    const band = bands.get(gs) || "?";
    const url = `${config.network}/observations/${obs.id}/`;

    table.push({
      id: obs.id,
      sat: name,
      norad: obs.norad_cat_id,
      transmitter: obs.transmitter_description || "",
      mode: obs.transmitter_mode,
      start: iso(start),
      end: iso(end),
      max_altitude: obs.max_altitude,
      status,
      station: gs,
      band,
      url,
    });

    const track = groundTrack(obs, config.sampleSeconds);
    if (!track) continue;  // unusable TLE: keep the row, skip the globe

    czml.push({
      id,
      name: `${name} (${obs.id})`,
      availability: interval,
      description:
        `<b>Observation:</b> <a href='${url}' target='_blank'>${obs.id}</a><br>` +
        `<b>Station:</b> ${names.get(gs) || ""} ${band} (${gs})<br>` +
        `<b>Satellite:</b> ${name} (${obs.norad_cat_id})<br>` +
        `<b>Transmitter:</b> ${obs.transmitter_description || ""}<br>` +
        `<b>Scheduled status:</b> ${status}<br>` +
        `<b>Max elevation:</b> ${obs.max_altitude}&deg;`,
      billboard: {
        image: SAT_ICON,
        scale: 0.45,
        color,
        disableDepthTestDistance: 1e7,
      },
      label: czmlLabel(name, color),
      path: {
        show: [{ interval, boolean: true }],
        width: 2,
        leadTime: 100000,
        trailTime: 100000,
        resolution: 30,
        material: { solidColor: { color } },
      },
      position: {
        interpolationAlgorithm: "LAGRANGE",
        interpolationDegree: 5,
        epoch: iso(start),
        cartographicDegrees: track,
      },
    });

    czml.push({
      id: `${id}-link`,
      availability: interval,
      polyline: {
        show: [{ interval, boolean: true }],
        width: 2,
        arcType: "NONE",
        material: linkMaterial,
        // Without EXT_frag_depth there is no logarithmic depth buffer, and a
        // line running from orbit to the ground loses to z-precision near the
        // surface. Drawing on depth failure keeps it visible there.
        depthFailMaterial: linkMaterial,
        positions: { references: [`${id}#position`, `station-${gs}#position`] },
      },
    });
  }

  table.sort((a, b) => a.start.localeCompare(b.start));
  return { czml, table, title };
}
