// Shading loss calculator. Given a site latitude and a list of obstacles
// around the panel array, computes a monthly shade-loss factor [12] in
// 0..1 (0 = no loss, 1 = fully shaded).
//
// Obstacle model — intentionally simple for a sales-tool level of fidelity:
//   { type: 'tree' | 'building' | 'chimney' | 'other',
//     heightM:  obstacle height above the panel plane, in meters,
//     distanceM: horizontal distance from the array center, in meters,
//     azimuthDeg: compass bearing from the array to the obstacle
//                 (0 = N, 90 = E, 180 = S, 270 = W),
//     widthDeg:  the obstacle's angular width as seen from the array
//                (default per type below) }
//
// For each sample sun position we ask: is the sun's azimuth inside the
// obstacle's angular window AND is the sun's altitude below the obstacle's
// apparent altitude (arctan(height / distance))? If yes, that time step is
// counted as blocked. Time steps are weighted by sin(altitude) as a
// first-order proxy for how much solar energy would arrive that hour.
//
// Limitations: assumes a horizontal panel plane (not tilt/azimuth-optimized),
// treats obstacles as opaque rectangles, uses a single representative day
// per month. For real design a tool like Aurora/HelioScope is needed —
// this is enough to make a sales-time judgement.
import { monthlySunSamples } from "./sunPath.js";

const DEFAULT_WIDTH_DEG = { tree: 20, building: 30, chimney: 8, other: 15 };

export function shadeFactorForMonths(lat, lon, obstacles) {
  if (!obstacles?.length) return Array(12).fill(0);
  const samplesByMonth = monthlySunSamples(lat, lon);
  return samplesByMonth.map((samples) => {
    if (!samples.length) return 0;
    let energyTotal = 0;
    let energyBlocked = 0;
    samples.forEach((s) => {
      const weight = Math.sin((s.altitude * Math.PI) / 180); // proxy for irradiance
      energyTotal += weight;
      if (isBlocked(s, obstacles)) energyBlocked += weight;
    });
    return energyTotal > 0 ? energyBlocked / energyTotal : 0;
  });
}

function isBlocked(sun, obstacles) {
  for (const ob of obstacles) {
    const h = Number(ob.heightM) || 0;
    const d = Number(ob.distanceM) || 0;
    if (h <= 0 || d <= 0) continue;
    const width = Number(ob.widthDeg) || DEFAULT_WIDTH_DEG[ob.type] || 15;
    const obAz = ((Number(ob.azimuthDeg) || 0) + 360) % 360;
    const dAz = angularDelta(sun.azimuth, obAz);
    if (dAz > width / 2) continue;
    const obstacleAlt = (Math.atan2(h, d) * 180) / Math.PI;
    if (sun.altitude < obstacleAlt) return true;
  }
  return false;
}

function angularDelta(a, b) {
  const d = Math.abs(((a - b + 540) % 360) - 180);
  return d;
}
