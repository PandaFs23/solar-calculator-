# CLAUDE.md — Solar Sizing Calculator

Authoritative briefing for anyone (human or AI) working on this repo. Read this before touching code.

## What this is

A solar + storage sales calculator with two modes: **Residential** (the original product) and **Commercial** (added 2026-07). React 18 + Vite, no backend required. Runs locally; **pushing to `main` auto-deploys to GitHub Pages** via `.github/workflows/deploy.yml` — do not push work that isn't meant to go live.

## Honest-data rules (non-negotiable)

1. **Specs are real, prices are estimates.** Panel/inverter/battery specs (watts, efficiency, warranty) come from the owner's spreadsheet `solar_products_complete_2000_2026_v17e.xlsx` (not in the repo — ask the owner for it). Prices are NOT in that database; every price in the app is an editable estimate and must be labeled as such in the UI.
2. **Derate ≠ device efficiency.** System derate = device efficiency × 0.88 environmental losses. Example: Enphase IQ8M is 97.6% device → 0.859 system derate. Never present device efficiency as system output, and never multiply device efficiency into a derate that already includes it. The owner has caught this mistake before.
3. Commercial products added 2026-07 are tagged `placeholder — confirm` in `src/data/commercialProducts.js` because the owner spreadsheet wasn't available; swap in real DB rows and re-tag `from owner DB` when it is.
4. Estimates get labeled in the UI (rate schedules, $/W tiers, MACRS). MACRS output must always carry "estimate, not tax advice."

## File layout

```
src/
  App.jsx                        # thin shell: header, Residential|Commercial pill, both modules
                                 #   (both stay mounted; inactive hidden with display:none so
                                 #    state survives switches and only the active print report prints)
  modules/
    ResidentialCalculator.jsx    # the original calculator
    CommercialCalculator.jsx     # commercial module (see model below)
  components/                    # shared UI: AerialView, Toggle, Field, MiniInput, NumInput,
                                 #   Slider, Stat, Section, ModeSuggestionBanner, RegulationsPanel
  data/
    constants.js                 # colors, seasonal factors, calc constants
    utilities.js                 # 100+ utilities, rate schedules, getSchedules(u, commercial=false)
    products.js                  # residential panels/inverters/batteries (specs from owner DB v17e)
    commercialProducts.js        # large-format panels (>500 W), 3-phase inverters, $/W cost tiers
    appliances.js, configs.js    # household loads, system-config presets
    regulations.js                # solar rules & incentives directory (see below)
  lib/
    geo.js                       # Geoapify (primary) + Nominatim (keyless fallback) geocoding,
                                 #   Open-Meteo irradiance, utility-territory guess,
                                 #   OSM property-type detection
    solarMath.js                 # computeResidential() — pure, the entire residential model
    commercialMath.js            # computeCommercial() — pure, the entire commercial model
scripts/
  check-links.mjs                # verifies every URL in src/data/regulations.js (see below)
server.js                        # optional local API (port 3001); solar-calculator.js = CLI engine
```

The pure functions in `lib/*Math.js` are the calculation ground truth — UI files should not contain sizing/economics math.

## Commercial model assumptions (all editable in the UI)

- **Two-part bills**: energy ($/kWh) + demand ($/kW/month, typical $10–25). The UI always shows the decomposition because demand charges are where batteries earn their keep commercially.
- Commercial energy rates estimated at 68–80% of the utility's residential rate (`getSchedules(u, true)`), demand charge defaults $10/$16/$22 by schedule size. Generic estimates — verify against the actual tariff (OpenEI links in the UI).
- **Self-consumption** default 75% (commercial load is daytime-coincident; 70–85% typical vs ~35% residential). Surplus exports at `EXPORT_RATE` ($0.08).
- **Cost tiers**: <100 kW ≈ $1.90/W, 100–500 kW ≈ $1.60/W, >500 kW ≈ $1.40/W — estimates, editable per-proposal.
- **Incentives**: 30% ITC; optional MACRS 5-yr toggle — benefit ≈ (cost − ½·ITC) × combined tax rate, single-number simplification, labeled estimate/not tax advice.
- **Battery = demand shaving**, not backup: clipped kW = min(inverter kW, kWh ÷ 3-hour peak window, peak × shave-depth target); savings = clipped kW × demand rate × 12. Real guarantees need 15-minute interval data — the UI says so.

## Property-type detection (mode suggestion)

After a successful address locate, `lib/geo.js#fetchPropertyType` reverse-geocodes via Nominatim at zoom=18 and classifies OSM `class`/`type` tags (house/apartments/… → residential; shop/office/amenity/industrial/craft or commercial/retail/warehouse/supermarket → commercial; else unknown). On a mismatch the module shows a dismissible banner with a one-click switch — **never auto-switches**. Manual mode choice (pill, dismiss, or accept) suppresses the banner for that address (`App.jsx` owns the suppressed set). OSM tagging is community-sourced and spotty — it's a hint; the manual pill is the primary control. If a Google Places key ever exists, its `place types` are the drop-in upgrade at this seam.

## Regulations data

`src/data/regulations.js` backs the "⚖ Solar rules & incentives in {state}" button (renders below the state dropdown in both modules; `src/components/RegulationsPanel.jsx`). It's a curated-links directory, not a legal database — the honest-data rule here is the same spirit as rule 1 above: **link to sources that maintain themselves (DSIRE, .gov, SEIA) instead of hardcoding paraphrased law.**

- `FEDERAL_ITEMS` — federal credits/depreciation (IRS, DSIRE, energy.gov), always shown as a category in every state's panel.
- `STATE_REGS` — curated depth (real statute citations, specific programs) for 10 states: CA, TX, AZ, CO, FL, NV, NC, NJ, NY, MA.
- `fallbackFor(stateCode)` — every other state + DC gets pattern-generated links: DSIRE's state query, the FTC's national solar consumer-protection guide, and a PUC-complaint search — safe because those URL patterns work for any state, verified against a sample before relying on them. (SEIA's per-state pages were dropped from the fallback in 2026-07: they now hard-block automated requests with a Cloudflare 403, so `check-links` can't verify them — the honest-data rule says don't ship a link you can't machine-check.)
- Every entry that asserts a specific rule (rate, statute number, deadline) carries a `verified: "YYYY-MM-DD"` date. Where a citation couldn't be confirmed against a live source, the entry links DSIRE's summary instead and says so in `note` — never assert an unconfirmed legal detail as fact.
- `scripts/check-links.mjs` (`npm run check-links`) actually imports and executes `regulations.js` (via `src/package.json`'s `"type": "module"`, scoped to that subtree only — root stays CommonJS for `server.js`/`solar-calculator.js`) rather than regex-scanning the source, so dynamically-built URLs (template literals, `fallbackFor()`'s per-state links) are checked with their real resolved values across all 50 states + DC, not just the 10 curated ones. HEAD falls back to GET (many gov/Cloudflare-fronted sites block or mis-handle HEAD); a Chrome-like User-Agent is required or SEIA/some `.gov` sites 403.
- **Maintenance**: re-run `npm run check-links` quarterly (regs and program pages move); DSIRE is the self-maintaining backbone so fallback-only states degrade gracefully even without a refresh. If a curated entry starts failing, prefer replacing it with DSIRE's summary over trying to hand-fix a broken deep link.

## Local development

- `npm run dev` → http://localhost:5173 · `npm run build` must stay green at every commit.
- **Geocoding works with zero keys locally**: without `VITE_GEOAPIFY_KEY` in `.env.local`, `lib/geo.js` falls back to Nominatim search (fine for light interactive use). Geoapify keys (free tier) are still preferred for a deployed site — see `.env.example`.
- Node.js is installed user-scope via winget; `.claude/launch.json` starts the dev server with the full node path.
- Verified regression scenario (must hold after any refactor): Annual kWh mode, 8,400 kWh/yr, SDG&E TOU-DR1 defaults, Q.Cells Q.HOME NEXT L-G3 435 W, Enphase IQ8M → **13 panels, 5.7 kW, $15,551 gross / $10,886 net, 3.1-yr payback, $143,338 25-yr, 106% offset**. (Quirk preserved on purpose: initial `rate`/`sunHrs` seed from `UTILITIES[0]` = PG&E $0.42/5.0 hrs even though SDG&E is preselected.)

## Backlog (needs owner input where noted)

- Real distributor pricing for panels, inverters, batteries (owner) — replaces $/W and $/kWh estimates.
- Commercial panel specs from the owner spreadsheet (owner re-provides `v17e.xlsx`) — replace `placeholder — confirm` entries.
- Demand-charge defaults per utility (owner/tariff research) — currently generic $10/$16/$22.
- On/off-peak TOU windows (both modes model average rates only; no hourly simulation).
- PDF bill scanner: removed until an API key is available; restore behind a local backend proxy (`server.js` is the seam) rather than a browser-exposed key.
- Panel-count grid visual for very large commercial arrays (currently caps at 60 cells + overflow count).
