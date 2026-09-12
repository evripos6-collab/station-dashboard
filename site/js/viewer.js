// Cesium is loaded as a global by the script tag in index.html.

// The default skybox is muddy at this zoom level, so the star field is drawn
// procedurally onto six identical faces.
function starFace() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1024;
  const g = canvas.getContext("2d");
  g.fillStyle = "#010208";
  g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 850; i++) {
    const x = Math.random() * 1024, y = Math.random() * 1024;
    const bright = Math.random() > 0.93;
    const r = bright ? 1.1 + Math.random() * 1.5 : 0.3 + Math.random() * 0.8;
    const t = Math.random();
    const col = t < .12 ? "173,203,255" : t < .22 ? "255,216,176" : "255,255,255";
    g.fillStyle = `rgba(${col},${bright ? .85 + Math.random() * .15 : .2 + Math.random() * .5})`;
    g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
    if (bright) {
      g.fillStyle = `rgba(${col},0.10)`;
      g.beginPath(); g.arc(x, y, r * 3, 0, 6.2832); g.fill();
    }
  }
  return canvas.toDataURL();
}

async function addImagery(viewer) {
  try {
    const esri = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
      "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer");
    viewer.imageryLayers.addImageryProvider(esri);
  } catch (error) {
    console.warn("Esri imagery unavailable, using OSM:", error);
    viewer.imageryLayers.addImageryProvider(
      new Cesium.OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/" }));
  }
}

export function createViewer(containerId) {
  // No Cesium ion asset is used, so no ion token is needed or sent.
  Cesium.Ion.defaultAccessToken = undefined;

  const viewer = new Cesium.Viewer(containerId, {
    baseLayer: false,
    baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false,
    navigationHelpButton: false, infoBox: true, timeline: true, animation: true,
    shadows: false,
  });

  const scene = viewer.scene;
  scene.globe.baseColor = Cesium.Color.fromCssColorString("#0b1016");
  addImagery(viewer);

  scene.skyBox = new Cesium.SkyBox({
    sources: {
      positiveX: starFace(), negativeX: starFace(),
      positiveY: starFace(), negativeY: starFace(),
      positiveZ: starFace(), negativeZ: starFace(),
    },
  });

  scene.skyAtmosphere.show = true;
  scene.globe.showGroundAtmosphere = true;
  scene.globe.enableLighting = true;
  scene.globe.dynamicAtmosphereLighting = true;
  scene.globe.dynamicAtmosphereLightingFromSun = true;
  scene.fog.enabled = true;
  scene.fog.density = 0.0004;
  scene.highDynamicRange = true;
  scene.moon.show = true;

  return viewer;
}

export function flyHome(viewer, stations, duration = 0) {
  if (!stations.length) return;
  const lat = stations.reduce((a, s) => a + s.lat, 0) / stations.length;
  const lng = stations.reduce((a, s) => a + s.lng, 0) / stations.length;
  // One station needs less room than a spread-out pair, but stay high enough
  // that a whole LEO pass fits in frame.
  const alt = stations.length > 1 ? 1.3e6 : 2.4e6;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(lng, lat, alt),
    duration,
  });
}
