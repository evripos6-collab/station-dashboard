const TILE_WAIT_MS = 6000;

export function setProgress(fraction, step) {
  const fill = document.getElementById("splash-fill");
  const label = document.getElementById("splash-step");
  if (!fill) return;
  fill.style.width = `${Math.round(fraction * 100)}%`;
  if (step) label.textContent = step;
}

// Imagery keeps streaming after the data is in place, so waiting for the
// globe to settle avoids fading into a half-drawn Earth. Capped, because on a
// slow connection the tiles may never all arrive.
function tilesSettled(viewer) {
  if (viewer.scene.globe.tilesLoaded) return Promise.resolve();
  return new Promise(resolve => {
    const deadline = Date.now() + TILE_WAIT_MS;
    const timer = setInterval(() => {
      if (viewer.scene.globe.tilesLoaded || Date.now() > deadline) {
        clearInterval(timer);
        resolve();
      }
    }, 120);
  });
}

export async function hideSplash(viewer) {
  await tilesSettled(viewer);
  setProgress(1, "ready");
  const splash = document.getElementById("splash");
  if (!splash) return;
  splash.classList.add("gone");
  setTimeout(() => splash.remove(), 600);
}
