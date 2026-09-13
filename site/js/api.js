const MAX_PAGES = 50;

// Window bounds are floored to a grid so every viewer asks for the same URL
// within the same slot. Second-precision bounds make each request unique,
// which defeats the Worker's cache and multiplies upstream load by the number
// of people watching.
const WINDOW_GRID_MS = 300e3;

export function iso(date) {
  return date.toISOString().replace(/\.\d+Z$/, "Z");
}

// Network paginates with a cursor carried in the Link header, not in the body.
// A response with no Link is the last page.
export function nextLink(header) {
  if (!header) return null;
  for (const part of header.split(/,\s*(?=<)/)) {
    const match = part.match(/^\s*<([^>]+)>\s*;\s*rel="?next"?/);
    if (match) return match[1];
  }
  return null;
}

function endpoint(config, path, params) {
  const url = new URL(config.proxy + path);
  for (const [key, value] of Object.entries(params || {})) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function getPage(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} from ${url}`);
  }
  return {
    items: await response.json(),
    next: nextLink(response.headers.get("Link")),
  };
}

async function getAll(url) {
  const items = [];
  let next = url;
  for (let page = 0; page < MAX_PAGES && next; page++) {
    const result = await getPage(next);
    items.push(...(Array.isArray(result.items) ? result.items : result.items.results || []));
    next = result.next;
  }
  // Stopping quietly here is how a truncated window looks like a working one.
  if (next) throw new Error(`pagination did not end within ${MAX_PAGES} pages: ${url}`);
  return items;
}

export async function fetchStation(config, id) {
  const { items } = await getPage(endpoint(config, "/api/stations/", { id }));
  const list = Array.isArray(items) ? items : items.results || [];
  if (!list.length) throw new Error(`station ${id} not found`);
  return list[0];
}

// start__lt / end__gt is an overlap test, so a pass already in progress is
// returned. Filtering on start alone drops it.
export function fetchObservations(config, id, now) {
  const slot = Math.floor(now.getTime() / WINDOW_GRID_MS) * WINDOW_GRID_MS;
  return getAll(endpoint(config, "/api/observations/", {
    ground_station: id,
    start__lt: iso(new Date(slot + config.hoursFuture * 3600e3)),
    end__gt: iso(new Date(slot - config.hoursPast * 3600e3)),
  }));
}

export async function fetchAll(config, now = new Date()) {
  const stations = [];
  const observations = [];
  const seen = new Set();

  for (const { id, band } of config.stations) {
    stations.push({ ...(await fetchStation(config, id)), band });
    for (const obs of await fetchObservations(config, id, now)) {
      if (seen.has(obs.id)) continue;
      seen.add(obs.id);
      observations.push(obs);
    }
  }

  observations.sort((a, b) => a.start.localeCompare(b.start));
  return { stations, observations, fetched: now };
}
