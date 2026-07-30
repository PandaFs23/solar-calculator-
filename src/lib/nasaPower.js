// NASA POWER monthly climatology — the irradiance source behind the
// production model. https://power.larc.nasa.gov/docs/ — free, no API key.
//
// Parameter: ALLSKY_SFC_SW_DWN, "All Sky Surface Shortwave Downward
// Irradiance", returned by the climatology endpoint in kW-hr/m^2/day for each
// month (keys JAN..DEC, plus ANN). Numerically that per-month value IS the peak
// sun hours per day for that location and month, which is exactly what the
// sizing model wants.
//
// ── HONEST-DATA RULE (see CLAUDE.md) ────────────────────────────────────────
// This replaces the peak-sun-hours ASSUMPTION only. It does NOT replace, and
// must never be folded into, the 0.88 environmental derate. Those are two
// distinct loss stages:
//
//   monthly_production_kWh = system_kW_DC
//                          × PSH_day[month]        ← from here
//                          × days_in_month[month]
//                          × derate                ← device_eff × 0.88, UNCHANGED
//
// If you ever find yourself multiplying an efficiency term twice, stop.
// `npm run check-regression` asserts derate is applied exactly once.
//
// Both this and the Open-Meteo fetcher in geo.js report irradiance on a
// HORIZONTAL plane, so substituting one for the other is apples-to-apples. A
// tilted array sees a different number; neither source models tilt, and the UI
// labels the basis rather than implying more precision than exists.
const CACHE_KEY = "sc.nasaPower.v2"; // v2: climatology endpoint, 3-decimal key
const TIMEOUT_MS = 12000;

// 3 decimals ≈ 110 m — finer than the POWER grid itself, so this only serves
// to stop re-fetching while the same address is being re-resolved.
function roundKey(la, lo) {
  return `${la.toFixed(3)}_${lo.toFixed(3)}`;
}

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") || {};
  } catch { return {}; }
}
function writeCache(obj) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(obj)); } catch { /* quota — silently drop */ }
}

const MONTH_KEYS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// Concurrent callers for the same site share one request — a geocode can fire
// several renders before the first response lands.
const inFlight = new Map();

export async function fetchMonthlyGHI(la, lo) {
  const key = roundKey(la, lo);
  const cache = readCache();
  if (cache[key]) return cache[key];
  if (inFlight.has(key)) return inFlight.get(key);

  const url =
    `https://power.larc.nasa.gov/api/temporal/climatology/point` +
    `?parameters=ALLSKY_SFC_SW_DWN&community=RE` +
    `&latitude=${la}&longitude=${lo}&format=JSON`;

  const task = (async () => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(url, { signal: ctl.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new Error(`NASA POWER HTTP ${res.status}`);
    const json = await res.json();
    const p = json?.properties?.parameter?.ALLSKY_SFC_SW_DWN;
    if (!p) throw new Error("NASA POWER: no ALLSKY_SFC_SW_DWN in response");

    // POWER uses -999 for fill/no-data; treat anything non-positive as missing.
    const monthly = MONTH_KEYS.map((m) => {
      const v = Number(p[m]);
      return Number.isFinite(v) && v > 0 ? v : 0;
    });
    if (monthly.some((v) => v === 0)) throw new Error("NASA POWER: incomplete monthly series");

    // Prefer POWER's own annual figure; fall back to the mean of the months.
    const ann = Number(p.ANN);
    const annualDailyAvg = Number.isFinite(ann) && ann > 0
      ? ann
      : monthly.reduce((s, v) => s + v, 0) / 12;

    const record = {
      monthly,          // kWh/m²/day per month, Jan..Dec — i.e. peak sun hrs/day
      annualDailyAvg,   // kWh/m²/day annual average
      fetchedAt: Date.now(),
      source: "NASA POWER climatology (ALLSKY_SFC_SW_DWN)",
    };
    const fresh = readCache();
    fresh[key] = record;
    writeCache(fresh);
    return record;
  })();

  inFlight.set(key, task);
  try {
    return await task;
  } finally {
    inFlight.delete(key);
  }
}
