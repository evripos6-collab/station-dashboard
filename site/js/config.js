const DEFAULTS = {
  proxy: "https://satnogs-cors-proxy.nkuasatnogs.workers.dev",
  stations: "4755:UHF,4791:UHF,5026:VHF",
  past: 3,
  future: 24,
  sample: 15,
  refresh: 5,
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

export function readConfig(search = window.location.search) {
  const q = new URLSearchParams(search);
  return {
    proxy: (q.get("proxy") || DEFAULTS.proxy).replace(/\/+$/, ""),
    stations: parseStations(q.get("stations") || DEFAULTS.stations),
    hoursPast: number(q.get("past"), DEFAULTS.past),
    hoursFuture: number(q.get("future"), DEFAULTS.future),
    sampleSeconds: number(q.get("sample"), DEFAULTS.sample),
    refreshMinutes: number(q.get("refresh"), DEFAULTS.refresh),
  };
}
