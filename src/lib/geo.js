// Geoapify geocoding + Open-Meteo solar irradiance fetchers.
// Keys come from .env.local (VITE_GEOAPIFY_KEY / VITE_GEOAPIFY_AUTOCOMPLETE_KEY) —
// see .env.example. Open-Meteo needs no key.
import { UTILITIES, STATE_CODES } from "../data/utilities.js";

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

// rough state + utility territory guess from coordinates; returns
// { id, label } for the status line or null when there's no basis to guess
export function guessUtility(la, lo, stateName) {
  if (lo >= -125 && lo < -114.1 && la >= 32.4 && la <= 42.1) {
    // California
    if (la < 33.6 && lo > -118) return { id: "sdge", label: "SDG&E" };
    if (la >= 38.3 && la <= 38.9 && lo >= -121.7 && lo <= -121.0) return { id: "smud", label: "SMUD" };
    if (la < 35.0) return { id: "sce", label: "SCE" };
    return { id: "pge", label: "PG&E" };
  }
  if (lo >= -114.9 && lo <= -109.0 && la >= 31.3 && la <= 37.0) {
    // Arizona
    if (la < 32.6 && lo > -111.5) return { id: "tep", label: "TEP" };
    return { id: "aps", label: "APS / SRP" };
  }
  if (lo >= -109.1 && lo <= -102.0 && la >= 36.9 && la <= 41.1) {
    // Colorado
    if (la >= 38.6 && la <= 39.1 && lo >= -105.1 && lo <= -104.5) return { id: "csu", label: "Colorado Springs Utilities" };
    return { id: "xcel", label: "Xcel Energy" };
  }
  if (stateName && STATE_CODES[stateName]) {
    // anywhere else in the USA: geocoder tells us the state; default to its major utility
    const first = UTILITIES.find((u) => u.st === STATE_CODES[stateName]);
    if (first) return { id: first.id, label: `${stateName} — defaulted to ${first.name}, confirm below` };
  }
  return null;
}
