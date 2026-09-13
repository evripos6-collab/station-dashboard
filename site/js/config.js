const DEFAULTS = {
  proxy: "https://satnogs-cors-proxy.nkuasatnogs.workers.dev",
  network: "https://network.satnogs.org",
  stations: "4755:UHF,4791:UHF,5026:VHF",
  past: 2,
  future: 12,
  sample: 15,
  pitch: -40,
  range: 0,
  refresh: 5,
  idle: 120,
  links: "dash",
  oit: false,
  hdr: true,
};

export function parseStations(spec) {
  const stations = [];
  for (const part of spec.split(",")) {
    const [id, band = ""] = part.trim().split(":");
    if (!id.trim()) continue;
    stations.push({ id: Number(id), band: band.trim() || "?" });
  }
  if (!stations.length) throw new Error(`no stations in "${spec}"`);
  return stations;
}

function number(value, fallback) {
  const n = Number(value);
  return value !== null && Number.isFinite(n) ? n : fallback;
}

function flag(value, fallback) {
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return fallback;
}

export function readConfig(search = window.location.search) {
  const q = new URLSearchParams(search);
  return {
    proxy: (q.get("proxy") || DEFAULTS.proxy).replace(/\/+$/, ""),
    network: (q.get("network") || DEFAULTS.network).replace(/\/+$/, ""),
    stations: parseStations(q.get("stations") || DEFAULTS.stations),
    hoursPast: number(q.get("past"), DEFAULTS.past),
    hoursFuture: number(q.get("future"), DEFAULTS.future),
    sampleSeconds: number(q.get("sample"), DEFAULTS.sample),
    idleMinutes: number(q.get("idle"), DEFAULTS.idle),
    linkStyle: q.get("links") === "solid" ? "solid" : DEFAULTS.links,
    debug: flag(q.get("debug"), false),
    oit: flag(q.get("oit"), DEFAULTS.oit),
    hdr: flag(q.get("hdr"), DEFAULTS.hdr),
    cameraPitch: number(q.get("pitch"), DEFAULTS.pitch),
    cameraRange: number(q.get("range"), DEFAULTS.range),
    refreshMinutes: number(q.get("refresh"), DEFAULTS.refresh),
  };
}
