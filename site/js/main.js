import { readConfig } from "./config.js";
import { fetchAll } from "./api.js";
import { buildCzml } from "./czml.js";
import { createViewer, flyHome } from "./viewer.js";
import { renderChips, renderTable, showAge, paint, wireToggle } from "./panel.js";
import { animateLinks } from "./links.js";
import { setProgress, hideSplash } from "./splash.js";

const config = readConfig();
const viewer = createViewer("cesiumContainer");
wireToggle();

let source = null;
let updated = null;
let failure = null;
let framed = false;

async function showCzml(czml) {
  // If the user has scrubbed the timeline back to an earlier pass, leave them
  // there rather than yanking them to now on every refresh.
  const before = viewer.clock.currentTime;
  const wasLive = !before || Math.abs(
    Cesium.JulianDate.secondsDifference(Cesium.JulianDate.now(), before)) < 120;

  const next = await Cesium.CzmlDataSource.load(czml);
  viewer.dataSources.removeAll();
  await viewer.dataSources.add(next);
  source = next;
  animateLinks(next);

  if (wasLive) {
    viewer.clock.currentTime = Cesium.JulianDate.now();
    viewer.clock.shouldAnimate = true;
  } else {
    viewer.clock.currentTime = before;
  }
}

function track(id) {
  const entity = source && source.entities.getById(id);
  if (entity) viewer.trackedEntity = entity;
}

async function refresh() {
  const first = updated === null;
  try {
    if (first) setProgress(0.15, "contacting network");
    const { stations, observations } = await fetchAll(config);

    if (first) setProgress(0.55, "propagating orbits");
    const { czml, table, title } = buildCzml(stations, observations, config);

    if (first) setProgress(0.8, "building scene");
    await showCzml(czml);
    document.title = `${title} \u2014 SatNOGS`;
    document.getElementById("title").textContent = title;
    renderChips(stations);
    renderTable(table, track);

    if (!framed) {
      flyHome(viewer, stations, config, 0);
      framed = true;
    }
    updated = Date.now();
    failure = null;
  } catch (error) {
    // Keep the last good scene: a stale globe beats a blank one.
    failure = error.message;
    console.error(error);
  }
  // Even a failed first pass has to let go of the splash, or the error in the
  // panel is never seen.
  if (first) await hideSplash(viewer);
}

viewer.clock.onTick.addEventListener(() => {
  paint(Cesium.JulianDate.toDate(viewer.clock.currentTime).getTime());
  const age = updated == null ? null : (Date.now() - updated) / 1000;
  showAge(age, (age ?? Infinity) > config.refreshMinutes * 60 * 2, failure);
});

refresh();
setInterval(refresh, config.refreshMinutes * 60 * 1000);
