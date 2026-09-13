// Link lines get their own colour so they read as a downlink rather than as
// part of the satellite's track, which is coloured by observation status.
export const LINK_COLOR = [251, 224, 255, 255];

const BURST = 0b0000000000011111;
const STEP_MS = 55;
const DIRECTION = 1;  // flip to -1 to send the bursts the other way

export const LINK_DASH = {
  color: { rgba: LINK_COLOR },
  gapColor: { rgba: [78, 70, 79, 80] },
  dashLength: 32,
  dashPattern: BURST,
};

function rotate(pattern, steps) {
  const n = ((steps % 16) + 16) % 16;
  return ((pattern << n) | (pattern >>> (16 - n))) & 0xffff;
}

// dashPattern is a static screen-space stipple, so nothing moves on its own.
// Rotating its 16 bits every frame is what makes the bursts travel.
export function animateLinks(source) {
  for (const entity of source.entities.values) {
    if (!entity.polyline || !String(entity.id).endsWith("-link")) continue;
    const pattern = new Cesium.CallbackProperty(
      () => rotate(BURST, DIRECTION * Math.floor(Date.now() / STEP_MS)), false);
    entity.polyline.material.dashPattern = pattern;
    if (entity.polyline.depthFailMaterial) {
      entity.polyline.depthFailMaterial.dashPattern = pattern;
    }
  }
}
