// Geoapify geocoding + Open-Meteo solar irradiance fetchers.
// Keys come from .env.local (VITE_GEOAPIFY_KEY / VITE_GEOAPIFY_AUTOCOMPLETE_KEY) —
// see .env.example. Open-Meteo needs no key.

export async function fetchAddressSuggestions(text) {
  const key = import.meta.env.VITE_GEOAPIFY_AUTOCOMPLETE_KEY;
  const res = await fetch(
    `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}&filter=countrycode:us&limit=5&format=json&apiKey=${key}`
  ).then((x) => x.json());
  return (res?.results || []).map((g) => ({
    label: g.formatted,
    lat: g.lat, lon: g.lon,
    state: g.state || null,
  }));
}

export async function geocodeAddress(text) {
  const key = import.meta.env.VITE_GEOAPIFY_KEY;
  const geo = await fetch(
    `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(text)}&filter=countrycode:us&limit=1&format=json&apiKey=${key}`
  ).then((x) => x.json());
  if (!geo?.results?.length) throw new Error("not found");
  const { lat, lon, formatted, state } = geo.results[0];
  return { lat, lon, formatted, state: state || null };
}

// last full calendar year of daily solar radiation (MJ/m²) → average peak sun hours
export async function fetchPeakSunHours(la, lo) {
  const yr = new Date().getFullYear() - 1;
  const met = await fetch(
    `https://archive-api.open-meteo.com/v1/archive?latitude=${la}&longitude=${lo}&start_date=${yr}-01-01&end_date=${yr}-12-31&daily=shortwave_radiation_sum&timezone=auto`
  ).then((x) => x.json());
  const days = met?.daily?.shortwave_radiation_sum?.filter((v) => v != null) || [];
  if (!days.length) throw new Error("no solar data");
  const annualKwhM2 = days.reduce((s, v) => s + v, 0) / 3.6; // MJ→kWh
  const psh = Math.min(7, Math.max(3, annualKwhM2 / days.length));
  return { psh, yr };
}
