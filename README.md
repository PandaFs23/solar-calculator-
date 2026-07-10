# Solar Sizing Calculator

Hello! My name is Nick and I wanted to create this solar app tool for anyone to use and get a free way to look at starting to design their own solar system. I never saw a tool online without them selling data to installers and adverts to get to set up a system with so much haste. I work in the solar industry as a service technician so I see a lot of missteps and horrible mistakes along the way. Please let me know if anything fails and or you're having trouble with the system in any way — I will be happy to get it fixed.

---

A professional-grade residential solar sizing tool. Upload a utility bill to auto-fill, or enter usage manually. Calculates panel count, system cost, payback period, and 25-year savings — factoring in existing solar, batteries, and future loads like EVs.

**Live app:** [pandafs23.github.io/solar-calculator-](https://pandafs23.github.io/solar-calculator-/)

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- npm v9 or higher

### Install
```bash
git clone https://github.com/PandaFs23/solar-calculator-.git
cd solar-calculator-
npm install
```

### Run locally

**Frontend (React + Vite):**
```bash
npm run dev
# Opens at http://localhost:5173
```

**API server (optional — for local testing of the calculation engine):**
```bash
npm run api
# Runs at http://localhost:3001
```

**Lint:**
```bash
# First install ESLint (one-time):
npm install --save-dev eslint @eslint/js globals eslint-plugin-react eslint-plugin-react-hooks

npm run lint
```

---

## Architecture

```
solar-calculator-/
├── src/
│   ├── App.jsx                        ← Thin shell: header + Residential|Commercial mode switch
│   ├── modules/
│   │   ├── ResidentialCalculator.jsx  ← Residential calculator
│   │   └── CommercialCalculator.jsx   ← Commercial calculator (demand charges, MACRS, peak shaving)
│   ├── components/                    ← Shared UI (AerialView, inputs, toggles, stats, banner)
│   ├── data/                          ← Data catalogs — easy to update without touching UI
│   │   ├── constants.js               ← Colors, seasonal factors, calc constants
│   │   ├── utilities.js               ← 100+ US utilities, rate schedules, getSchedules(u, commercial)
│   │   ├── products.js                ← Residential panels, inverters, batteries
│   │   ├── commercialProducts.js      ← Large-format commercial panels, 3-phase inverters, cost tiers
│   │   ├── appliances.js              ← Household load defaults (watts + annual kWh)
│   │   └── configs.js                 ← System configuration presets
│   ├── lib/
│   │   ├── geo.js                     ← Geocoding (Geoapify → Nominatim fallback), irradiance, OSM property type
│   │   ├── solarMath.js               ← Residential sizing/economics model (pure)
│   │   └── commercialMath.js          ← Commercial sizing/economics model (pure)
│   ├── main.jsx                       ← App entry point
│   └── index.css                      ← Global styles
├── CLAUDE.md                          ← Authoritative dev briefing (data rules, model assumptions)
├── server.js                          ← Local Node.js API server (port 3001)
├── solar-calculator.js                ← Standalone CLI calculator
└── .github/workflows/
    └── deploy.yml                     ← Auto-deploy to GitHub Pages on every push to main
```

### Key Features
- **Bill scanner** — AI reads a PDF utility bill (Anthropic Claude) and auto-fills utility, usage, rate, and any existing solar/battery from a NEM statement *(requires API key — see [Enabling Bill Scanning](#enabling-bill-scanning) below)*
- **Address lookup** — Nominatim geocoding + Open-Meteo solar irradiance data for real measured peak sun hours at the exact property
- **Satellite roof view** — Esri World Imagery aerial map centered on the located address
- **Product catalog** — Real panel, inverter, and battery specs (see `src/data/products.js`)
- **25-year savings model** — Includes utility rate escalation (4%/yr), panel degradation (0.5%/yr), and battery arbitrage economics
- **Print / PDF report** — `window.print()` produces a clean customer-ready report

---

## Enabling Bill Scanning

The PDF bill upload uses Anthropic's Claude AI. It is **off by default** — the rest of the app works fully without it.

To enable it locally:

1. Get an API key from [console.anthropic.com](https://console.anthropic.com)
2. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
3. Paste your key into `.env.local`:
   ```
   VITE_ANTHROPIC_API_KEY=sk-ant-...
   ```
4. Run `npm run dev` — bill scanning will now work

> **Privacy note:** When bill scanning is enabled, the uploaded PDF is sent to Anthropic's API for processing. The app itself stores nothing — no user data is saved anywhere.

> **Production note:** For a deployed site, a backend proxy is the more secure approach (keeps the key off the client). The included `server.js` can be extended for this purpose.

---

## Updating Data

All product and utility data lives in `src/data/` — no need to touch the component:

| File | What to update |
|---|---|
| `src/data/utilities.js` | Add or edit utilities, rate schedules |
| `src/data/products.js` | Add new panels, inverters, or batteries |
| `src/data/constants.js` | Adjust tax credit %, cost per watt, export rate, default constants |
| `src/data/appliances.js` | Add or adjust household load defaults |
| `src/data/configs.js` | Edit system configuration preset descriptions |

---

## API Reference

The local server (`npm run api`) exposes:

### `POST /calculate`
Calculate a solar system sizing from JSON input.

**Example request body:**
```json
{
  "utilityId": "sdge",
  "inputMode": "kwh",
  "annualKwh": 8400,
  "panelProdId": "q_cells_q_home_next_l_g3_420_435_w",
  "invProdId": "enphase_iq8m",
  "battMode": "new",
  "battProdId": "pw3",
  "battUnits": 1
}
```

Run a sample calculation from the command line:
```bash
node solar-calculator.js sample
```

### `GET /health`
Returns `{ "status": "ok" }`.

---

## Deployment

Pushing to `main` automatically builds and deploys to GitHub Pages via `.github/workflows/deploy.yml`. No manual steps needed.

---

## Third-Party Services

| Service | Used for | Key required | Notes |
|---|---|---|---|
| [Anthropic Claude](https://anthropic.com) | PDF bill scanning | Yes (optional) | See [Enabling Bill Scanning](#enabling-bill-scanning). Not used unless key is configured. |
| [Nominatim / OpenStreetMap](https://nominatim.org) | Address geocoding | No | Free public API. Browser automatically sends the page URL as a `Referer` header, which identifies the app per Nominatim's usage policy. |
| [Open-Meteo](https://open-meteo.com) | Historical solar irradiance | No | Free, generous limits, no key needed. |
| [Esri World Imagery](https://www.esri.com) | Satellite roof view | No | Public tile endpoint. Attribution shown in the map view ("Imagery © Esri World Imagery") as required. |

---

## License

MIT
