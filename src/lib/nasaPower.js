// NASA POWER API wrapper for monthly solar irradiance (GHI).
// https://power.larc.nasa.gov/docs/ — free, no API key. Values are
// ALLSKY_SFC_SW_DWN in kWh/m²/day averaged monthly. We fetch a recent
// full year and cache by rounded coordinates (~1 km grid) in localStorage
// to avoid hammering the API on every recalculation.
//
// This is the honest-data path for feature 6: no browser-exposed API key,
// no CORS shim, no third-party billing. NREL NSRDB (point TMY3) is more
// precise but needs a key we don't expose client-side — restoreable behind
// server.js later.
const CACHE_KEY = "sc.nasaPower.v1";

function roundKey(la, lo) {
  return `${la.toFixed(2)}_${lo.toFixed(2)}`;
}

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") || {};
  } catch { return {}; }
}
function writeCache(obj) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(obj)); } catch { /* quota — silently drop */ }
}

export async function fetchMonthlyGHI(la, lo) {
  const cache = readCache();
  const key = roundKey(la, lo);
  if (cache[key]) return cache[key];

  // NASA POWER's monthly climatology endpoint (long-term average across the
  // start–end range). Using 2015–2023 gives a stable 9-year average that
  // doesn't wobble year-to-year.
  const url =
    `https://power.larc.nasa.gov/api/temporal/monthly/point` +
    `?parameters=ALLSKY_SFC_SW_DWN&community=RE` +
    `&longitude=${lo}&latitude=${la}` +
    `&start=2015&end=2023&format=JSON`;

  const res = await fetch(url).then((r) => r.json());
  const params = res?.properties?.parameter?.ALLSKY_SFC_SW_DWN;
  if (!params) throw new Error("NASA POWER: no data");

  // Aggregate per-month across the returned years. Keys look like "201501".."2023ANN".
  const sums = Array(12).fill(0);
  const counts = Array(12).fill(0);
  Object.entries(params).forEach(([k, v]) => {
    const m = k.match(/^\d{4}(0[1-9]|1[0-2])$/);
    if (!m || v == null || v < 0) return;
    const idx = Number(m[1]) - 1;
    sums[idx] += Number(v);
    counts[idx] += 1;
  });
  const monthly = sums.map((s, i) => (counts[i] > 0 ? s / counts[i] : 0));
  if (!monthly.some((v) => v > 0)) throw new Error("NASA POWER: empty series");

  const annualDailyAvg = monthly.reduce((s, v) => s + v, 0) / 12;
  const record = {
    monthly,         // kWh/m²/day per month (Jan..Dec)
    annualDailyAvg,  // kWh/m²/day annual average (≈ peak sun hours/day for a horizontal panel)
    fetchedAt: Date.now(),
    source: "NASA POWER (ALLSKY_SFC_SW_DWN, 2015–2023 climatology)",
  };
  cache[key] = record;
  writeCache(cache);
  return record;
}
