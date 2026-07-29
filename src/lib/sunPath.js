// Solar position calculator — simplified NOAA / Michalsky algorithm subset.
// Returns { altitude, azimuth } in degrees for a given lat/lon and JS Date.
// Accurate to ~1° which is fine for a sales-tool shading model. No external
// dependency (suncalc would work too — this keeps the bundle tiny).
//
// Convention: altitude = angle above horizon (0 = horizon, 90 = zenith).
// Azimuth = compass bearing from north measured clockwise (0 = N, 90 = E,
// 180 = S, 270 = W).
const deg = (r) => (r * 180) / Math.PI;
const rad = (d) => (d * Math.PI) / 180;

export function sunPosition(lat, lon, date) {
  // Julian day of the year fraction
  const jd = julianDay(date);
  const t = (jd - 2451545.0) / 36525; // Julian centuries since J2000

  // Solar longitude and anomaly
  const L0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const M = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const C =
    Math.sin(rad(M)) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(rad(2 * M)) * (0.019993 - 0.000101 * t) +
    Math.sin(rad(3 * M)) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * t;
  const appLong = trueLong - 0.00569 - 0.00478 * Math.sin(rad(omega));

  // Obliquity and declination
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(rad(omega));
  const decl = deg(Math.asin(Math.sin(rad(eps)) * Math.sin(rad(appLong))));

  // Equation of time (minutes)
  const y = Math.tan(rad(eps / 2)) ** 2;
  const eqTime =
    4 *
    deg(
      y * Math.sin(2 * rad(L0)) -
        2 * e * Math.sin(rad(M)) +
        4 * e * y * Math.sin(rad(M)) * Math.cos(2 * rad(L0)) -
        0.5 * y * y * Math.sin(4 * rad(L0)) -
        1.25 * e * e * Math.sin(2 * rad(M))
    );

  // Local solar time → hour angle
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const trueSolarTime = (utcMinutes + eqTime + 4 * lon) % 1440;
  const hourAngle = trueSolarTime / 4 < 0 ? trueSolarTime / 4 + 180 : trueSolarTime / 4 - 180;

  // Solar zenith and azimuth
  const cosZen =
    Math.sin(rad(lat)) * Math.sin(rad(decl)) +
    Math.cos(rad(lat)) * Math.cos(rad(decl)) * Math.cos(rad(hourAngle));
  const zenith = deg(Math.acos(Math.max(-1, Math.min(1, cosZen))));
  const altitude = 90 - zenith;

  const azNumer = -(Math.sin(rad(lat)) * cosZen - Math.sin(rad(decl)));
  const azDenom = Math.cos(rad(lat)) * Math.sin(rad(zenith));
  let azimuth = deg(Math.acos(Math.max(-1, Math.min(1, azNumer / (azDenom || 1e-9)))));
  if (hourAngle > 0) azimuth = (360 - azimuth) % 360;

  return { altitude, azimuth };
}

function julianDay(date) {
  let y = date.getUTCFullYear();
  let m = date.getUTCMonth() + 1;
  const d = date.getUTCDate() + (date.getUTCHours() + date.getUTCMinutes() / 60) / 24;
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

// Sample sun positions across one representative day (the 21st) of each month
// at hourly intervals. Returns array of 12 arrays of { hour, altitude, azimuth }
// with sunset/sunrise clipped (altitude > 0 only).
export function monthlySunSamples(lat, lon) {
  return Array.from({ length: 12 }, (_, m) => {
    const samples = [];
    for (let h = 5; h <= 20; h++) {
      // solar noon shifted by longitude — use approximate local hour by
      // constructing a UTC time equal to lon-adjusted local time
      const utcHour = h - lon / 15;
      const d = new Date(Date.UTC(2025, m, 21, Math.floor(utcHour), (utcHour % 1) * 60));
      const p = sunPosition(lat, lon, d);
      if (p.altitude > 0) samples.push({ hour: h, ...p });
    }
    return samples;
  });
}
