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
    // Without this, clicking the globe runs an ArcGIS Identify query and opens
    // the info box on whatever administrative polygon is under the cursor.
    const esri = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
      "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
      { enablePickFeatures: false });
    viewer.imageryLayers.addImageryProvider(esri);
  } catch (error) {
    console.warn("Esri imagery unavailable, using OSM:", error);
    viewer.imageryLayers.addImageryProvider(
      new Cesium.OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/" }));
  }
}

// Order-independent translucency needs float render targets; where those
// misbehave, translucent primitives such as the dashed link lines can drop out
// of the scene entirely.
export function createViewer(containerId, config) {
  // No Cesium ion asset is used, so no ion token is needed or sent.
  Cesium.Ion.defaultAccessToken = undefined;

  const viewer = new Cesium.Viewer(containerId, {
    baseLayer: false,
    baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false,
    navigationHelpButton: false, infoBox: true, timeline: true, animation: true,
    shadows: false,
    // Construction-time only: the scene property is read-only afterwards.
    orderIndependentTranslucency: config.oit,
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
  scene.highDynamicRange = config.hdr;
  scene.moon.show = true;

  return viewer;
}

export function flyHome(viewer, stations, config, duration = 0) {
  if (!stations.length) return;
  const target = Cesium.BoundingSphere.fromPoints(
    stations.map(s => Cesium.Cartesian3.fromDegrees(s.lng, s.lat)));
  // A non-finite pitch or range reaches the camera as a NaN position, which
  // makes every distance in the scene NaN and stops rendering outright.
  const pitch = Number.isFinite(config.cameraPitch) ? config.cameraPitch : -40;
  // A single station needs less room than a spread-out pair, but stay far
  // enough back that a whole LEO pass fits in frame.
  const range = config.cameraRange > 0
    ? config.cameraRange
    : (stations.length > 1 ? 3.0e6 : 3.6e6);
  viewer.camera.flyToBoundingSphere(target, {
    duration,
    offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(pitch), range),
  });
}
