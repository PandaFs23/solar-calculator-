# CLAUDE.md — Solar Sizing Calculator

Authoritative briefing for anyone (human or AI) working on this repo. Read this before touching code.

## What this is

A solar + storage sales calculator with two modes: **Residential** (the original product) and **Commercial** (added 2026-07). React 18 + Vite, no backend required. Runs locally; **pushing to `main` auto-deploys to GitHub Pages** via `.github/workflows/deploy.yml` — do not push work that isn't meant to go live.

## Honest-data rules (non-negotiable)

1. **Specs are real, prices are estimates.** Panel/inverter/battery specs (watts, efficiency, warranty) come from the owner's spreadsheet `solar_products_complete_2000_2026_v17e.xlsx` (not in the repo — ask the owner for it). Prices are NOT in that database; every price in the app is an editable estimate and must be labeled as such in the UI.
2. **Derate ≠ device efficiency.** System derate = device efficiency × 0.88 environmental losses. Example: Enphase IQ8M is 97.6% device → 0.859 system derate. Never present device efficiency as system output, and never multiply device efficiency into a derate that already includes it. The owner has caught this mistake before.
2b. **Irradiance ≠ derate.** NASA POWER irradiance replaces the *peak-sun-hours assumption* only. It is a separate loss stage from derate and the two must never be folded together:

    ```
    monthly_production_kWh = system_kW_DC × PSH_day[month] × days_in_month[month] × derate
    annual_production_kWh  = system_kW_DC × Σ(PSH_day[m] × days[m])              × derate
    ```

    Structurally enforced: the entire irradiance assumption enters `solarMath.js` through one term, `pshDaysYr`, so the NASA series cannot reach the derate. `npm run check-regression` asserts derate is applied exactly once and prints what derate² / derate-free would have produced if it ever drifts.
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
  hooks/
    useNumberDraft.js            # THE numeric-input fix: hold the raw string while focused,
                                 #   parse/clamp on blur. NumInput, MiniInput and the monthly
                                 #   grid all route through it — do not hand-roll a fourth
                                 #   numeric input that coerces on every keystroke
    useLocalStorage.js
  lib/
    geo.js                       # Geoapify (primary) + Nominatim (keyless fallback) geocoding,
                                 #   Open-Meteo irradiance, utility-territory guess,
                                 #   OSM property-type detection
    nasaPower.js                 # NASA POWER monthly climatology — the irradiance basis
    existingSystems.js           # tracked existing-array normalization (size basis, derate,
                                 #   aggregation) — shared by the editor and the model
    solarMath.js                 # computeResidential() — pure, the entire residential model
    commercialMath.js            # computeCommercial() — pure, the entire commercial model
scripts/
  check-links.mjs                # verifies every URL in src/data/regulations.js (see below)
  check-regression.mjs           # asserts the verified regression scenario + the honest-data
                                 #   invariants (see "Regression guard" below)
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

## Irradiance engine (NASA POWER)

`lib/nasaPower.js` fetches NASA POWER's **monthly climatology** for the located coordinates — `temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN&community=RE`, free, no API key. It returns `JAN`…`DEC` plus `ANN` in `kW-hr/m^2/day`, which numerically *is* peak sun hours per day for that month.

- **One-line rule: NASA replaces PSH, not derate.** See honest-data rule 2b above. Everything funnels through `pshDaysYr` in `solarMath.js`.
- **Basic tab: on by default and invisible.** No control is rendered. It is auto-fetched when an address is located and quietly powers the numbers.
- **Advanced tab: a visible switch, still default-on.** The panel exists to *opt out* and to inspect the monthly profile, not to opt in.
- **Three-tier fallback, each honestly labelled.** NASA POWER climatology → Open-Meteo measured at this address → the utility's regional average. A fetch failure or 12s timeout falls back silently and never blocks the calculation; Advanced shows a quiet "using regional average (NASA data unavailable)" chip. Never label a measured Open-Meteo value a "regional average".
- Cached in `localStorage` (`sc.nasaPower.v2`) at 3-decimal coordinates, with in-flight de-duplication. An incomplete monthly series (POWER uses `-999` fill) is **rejected** rather than treated as dark months, which would understate production.
- Both NASA and Open-Meteo report irradiance on a **horizontal plane**. Neither models array tilt; the UI labels the basis rather than implying precision that isn't there.

## Tracked existing systems (up to 5)

The primary "Home has existing solar" card is **entry 1**. `lib/existingSystems.js` + `components/ExistingSystemsPanel.jsx` hold **entries 2…5**, each independently removable, with the cap adjusting so the total never exceeds `MAX_SYSTEMS` (5). The tracker is **not** Advanced-only — a second array is a fact about the home, not an expert tuning knob.

- **One size basis per entry, so nothing drifts.** `sizeBasis: "panels"` derives kW from count × watts; `"kw"` derives the count from kW ÷ watts. The derived side renders read-only, so the two can never both accept input and disagree.
- **`lib/existingSystems.js` is the single source of truth.** The editor's "combined output" readout and the model's `existProd` both call `toModelSystems()`/`aggregateProduction()`. They used to be two separate implementations (the panel hardcoded a `0.8` derate) and could disagree with the proposal; `check-regression` now asserts they match.
- A recorded inverter/optimizer supplies that system's derate (already device eff × 0.88). No model recorded → the generic `DERATE`.
- Existing systems use the same irradiance basis as the new array.
- **A blank row contributes exactly zero.** `emptySystem()` starts at 0 kW / 0 panels and `toModelSystems()` drops rows with no capacity and no measured output — so adding a row can never silently move the proposal.
- Persisted per browser in `sc.res.systems.v2`; `normalizeSystem()` still tolerates v1-shaped rows.

## Monthly usage grid (Advanced only)

12 kWh inputs beside the power-company selection, read straight off the bill's usage history. Switching to the Advanced tab is what reveals it; Basic runs on the single annual/bill figure.

- Any value > 0 makes the 12 months the source of truth and **overrides** the annual/bill input; the computed annual sum is shown read-only for sanity-checking, and states plainly whether it is overriding or dormant.
- Pairs with the irradiance engine: NASA gives monthly *production*, this gives monthly *usage*, so the chart shows a true month-by-month offset instead of a flat annual average on a seasonal curve.
- Warns when partially filled — a sum over 4 of 12 months would understate the year.
- Cells use `hooks/useNumberDraft.js`. **Do not** write a numeric input that coerces the raw string on every keystroke: backspacing through a value hits `""`, `Number("")` is 0, and the field becomes impossible to retype. That bug has been fixed once; keep it fixed in one place.

## Geoapify (geocoding + autocomplete)

Two keys in `.env.local`, split by workload because the free tier is metered **per key**:

```
VITE_GEOAPIFY_KEY_PRIMARY=…     # geocoding + autocomplete
VITE_GEOAPIFY_KEY_SECONDARY=…   # the retry target when PRIMARY returns HTTP 429
```

Read via `import.meta.env`; never hardcoded. `.gitignore` covers `.env.local` and `.env.*.local` — verified. The legacy names (`VITE_GEOAPIFY_KEY`, `VITE_GEOAPIFY_AUTOCOMPLETE_KEY`) still resolve.

- `geoapifyJson()` retries once on the secondary key for **429 only**; any other non-OK status throws immediately rather than burning the secondary quota on a request that would fail identically. Both failing degrades to Nominatim.
- Autocomplete is debounced 300ms. Resolved addresses are cached for the session so re-renders and repeated Locate presses don't re-bill the quota.
- **Geoapify has no satellite static map.** `style=satellite` returns HTTP 400; every valid style is street/vector. The roof view uses keyless **Esri World Imagery** tiles instead. Don't re-point `AerialView` at `maps.geoapify.com/v1/staticmap`.
- Geocoding is an enhancement, never a hard dependency: with no keys the app runs on Nominatim + Esri and is fully usable.

> **`VITE_*` vars are inlined into the client bundle at build time.** That is inherent to a browser-side key, which is why Geoapify's own guidance is to domain-restrict them. Restrict both keys to the deploy origin, and see the backlog on rotating them.

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

### Regression guard

```bash
npm run check-regression
```

`scripts/check-regression.mjs` runs the pure model with the module's own default state and asserts the scenario above — so "the Basic math didn't move" is a command, not an eyeball. It also pins the honest-data invariants that the irradiance and multi-system work could plausibly break:

- explicit-null advanced inputs are byte-identical to the baseline
- derate applied exactly once (1 kW at 1 PSH → 365 × derate kWh, never derate²)
- with NASA irradiance, all 12 months and the annual total match `kW × PSH × days × derate` against live San Diego climatology
- an incomplete monthly series falls back to regional instead of modelling dark months
- blank tracked-system rows leave every output unchanged; real rows sum
- the editor's aggregate readout equals the `existProd` the model used

Note the scenario has **no address located**, so no NASA fetch happens and `pshDaysYr` is exactly `sunHrs × 365`. Locating an address legitimately changes the numbers (it did before this work too, via Open-Meteo) — that is not a regression.

Run it alongside `npm run build` at every commit boundary.

## Backlog (needs owner input where noted)

- **Rotate/replace the two Geoapify keys before any public deploy.** The pair currently in `.env.local` was pasted into a chat transcript, so treat them as disclosed. Generate fresh keys, domain-restrict them to the deploy origin, and remember `VITE_*` values are visible in the client bundle by design.
- Array tilt/azimuth for irradiance: NASA POWER `ALLSKY_SFC_SW_DWN` and Open-Meteo are both horizontal-plane. A tilted-plane transposition (or POWER's `SI_TILTED_AVG`) would be the honest upgrade at the `pshDaysYr` seam in `solarMath.js`.
- Real distributor pricing for panels, inverters, batteries (owner) — replaces $/W and $/kWh estimates.
- Commercial panel specs from the owner spreadsheet (owner re-provides `v17e.xlsx`) — replace `placeholder — confirm` entries.
- Demand-charge defaults per utility (owner/tariff research) — currently generic $10/$16/$22.
- On/off-peak TOU windows (both modes model average rates only; no hourly simulation).
- PDF bill scanner: removed until an API key is available; restore behind a local backend proxy (`server.js` is the seam) rather than a browser-exposed key.
- Panel-count grid visual for very large commercial arrays (currently caps at 60 cells + overflow count).
