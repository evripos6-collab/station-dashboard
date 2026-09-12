import * as satellite from "satellite.js";

export function satelliteName(obs) {
  return (obs.tle0 || obs.sat_id || "").trim();
}

// Flat [secondsFromEpoch, lon, lat, heightMetres] repeated, which is the shape
// CZML cartographicDegrees wants alongside an epoch.
//
// The window runs one sample past the end so the track does not stop short of
// the marker at the final interpolated position.
export function groundTrack(obs, sampleSeconds) {
  const satrec = satellite.twoline2satrec(obs.tle1, obs.tle2);
  const start = Date.parse(obs.start);
  const end = Date.parse(obs.end);
  const samples = [];

  for (let elapsed = 0; start + elapsed * 1000 <= end + sampleSeconds * 1000; elapsed += sampleSeconds) {
    const when = new Date(start + elapsed * 1000);
    const { position } = satellite.propagate(satrec, when);
    // A decayed orbit returns null; a TLE that failed to parse returns NaN
    // components with no error flag set. Both mean no usable track.
    if (!position) return null;

    const geodetic = satellite.eciToGeodetic(position, satellite.gstime(when));
    const lon = satellite.degreesLong(geodetic.longitude);
    const lat = satellite.degreesLat(geodetic.latitude);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;

    samples.push(elapsed, lon, lat, geodetic.height * 1000);
  }

  return samples;
}
