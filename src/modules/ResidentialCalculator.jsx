import { useState, useMemo, useRef, useEffect } from "react";
import { Sun, Zap, DollarSign, Percent, TrendingUp, PlusCircle, BatteryCharging, Loader2, MapPin, Plug, ShieldCheck, Printer, Sliders, Gauge, Trees, Home } from "lucide-react";
import {
  ComposedChart, Bar, Line, Area, AreaChart, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, ReferenceLine,
} from "recharts";


import { C, TAX_CREDIT, RATE_ESCALATION, EXPORT_RATE, BATT_EFF, EV_MI_PER_KWH, COST_PER_WATT, DEGRADATION, PANEL_SQFT, SOLAR_HOUR_SHARE, BATT_UTIL } from "../data/constants.js";
import { STATES, STATE_CODES, UTILITIES, INVERTERS, getSchedules } from "../data/utilities.js";
import { PANEL_PRODUCTS, LEGACY_PANEL_PRODUCTS, DISCONTINUED_PANEL_PRODUCTS, ALL_PANEL_PRODUCTS, INVERTER_PRODUCTS, LEGACY_INVERTER_PRODUCTS, DISCONTINUED_INVERTER_PRODUCTS, ALL_INVERTER_PRODUCTS, BATTERY_PRODUCTS, LEGACY_BATTERY_PRODUCTS, DISCONTINUED_BATTERY_PRODUCTS, ALL_BATTERY_PRODUCTS } from "../data/products.js";
import { APPLIANCES } from "../data/appliances.js";
import { SYS_CONFIGS } from "../data/configs.js";
import { computeResidential } from "../lib/solarMath.js";
import { fetchAddressSuggestions, geocodeAddress, fetchPeakSunHours, guessUtility, fetchPropertyType } from "../lib/geo.js";
import { fetchMonthlyGHI } from "../lib/nasaPower.js";
import { shadeFactorForMonths } from "../lib/shading.js";
import { toModelSystems, aggregateProduction, MAX_SYSTEMS } from "../lib/existingSystems.js";
import { checkFeasibility } from "../lib/feasibility.js";
import useLocalStorage from "../hooks/useLocalStorage.js";
import ModeSuggestionBanner from "../components/ModeSuggestionBanner.jsx";
import AerialView from "../components/AerialView.jsx";
import RegulationsPanel from "../components/RegulationsPanel.jsx";
import Toggle from "../components/Toggle.jsx";
import Field from "../components/Field.jsx";
import MiniInput from "../components/MiniInput.jsx";
import NumInput from "../components/NumInput.jsx";
import Slider from "../components/Slider.jsx";
import Stat from "../components/Stat.jsx";
import Section from "../components/Section.jsx";
import MonthlyUsageGrid from "../components/MonthlyUsageGrid.jsx";
import ExistingSystemsPanel from "../components/ExistingSystemsPanel.jsx";
import ShadingEditor from "../components/ShadingEditor.jsx";
import IrradiancePanel from "../components/IrradiancePanel.jsx";
import FeasibilityPanel from "../components/FeasibilityPanel.jsx";

const ADVANCED_DEFAULTS = {
  degradation: DEGRADATION, costPerWatt: COST_PER_WATT, taxCredit: TAX_CREDIT,
  panelSqft: PANEL_SQFT, rateEscalation: RATE_ESCALATION, exportRate: EXPORT_RATE,
  battEff: BATT_EFF, battUtil: BATT_UTIL, solarHourShare: SOLAR_HOUR_SHARE,
};

// Compact number-with-label input for the advanced-only site inputs.
function SiteInput({ label, value, onChange }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 11, color: C.dim }}>{label}</span>
      <input type="number" min={0} value={value || ""} placeholder="0"
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        style={{ background: C.slate, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: "6px 8px", fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", width: "100%", minWidth: 0, boxSizing: "border-box" }} />
    </label>
  );
}
function ConstInput({ label, value, step, min, max, decimals, onChange }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 11, color: C.dim }}>{label}</span>
      <input type="number" step={step} min={min} max={max}
        value={typeof value === "number" ? value.toFixed(decimals) : value}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
        style={{ background: C.slate, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: "6px 8px", fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", width: "100%", minWidth: 0, boxSizing: "border-box" }} />
    </label>
  );
}

export default function ResidentialCalculator({ onSwitchMode, onLocated, suppressedAddresses, suppressAddress }) {
  const [stateSel, setStateSel] = useState("CA");
  const [utilityId, setUtilityId] = useState("sdge");
  const [scheduleId, setScheduleId] = useState("toudr1");
  const [inputMode, setInputMode] = useState("bill");
  const [annualKwh, setAnnualKwh] = useState(8400);
  const [bill, setBill] = useState(280);
  const [rate, setRate] = useState(UTILITIES[0].rate);
  const [sunHrs, setSunHrs] = useState(UTILITIES[0].sunHrs);
  const [panels, setPanels] = useState(null);
  const [sizingBasis, setSizingBasis] = useState("energy"); // 'energy' (size to kWh usage) | 'power' (size to target kW)
  const [targetKw, setTargetKw] = useState(6);
  const [chartView, setChartView] = useState("monthly");

  // product selections
  const [panelProdId, setPanelProdId] = useState("q_cells_q_home_next_l_g3_420_435_w");
  const [invProdId, setInvProdId] = useState("enphase_iq8m");
  const [battProdId, setBattProdId] = useState("pw3");
  const [battUnits, setBattUnits] = useState(1);
  const [sysConfig, setSysConfig] = useState("custom");

  // existing solar
  const [hasExisting, setHasExisting] = useState(false);
  const [existKw, setExistKw] = useState(4.0);
  const [existType, setExistType] = useState("micro");
  const [existAge, setExistAge] = useState(5);
  const [existProdOverride, setExistProdOverride] = useState(null);
  const [existPanelProdId, setExistPanelProdId] = useState(""); // "" = not specified / generic
  const [existInvProdId, setExistInvProdId] = useState("");     // "" = use the generic architecture toggle
  // Size basis for the primary array, mirroring the tracked-systems rule: one
  // side is entered, the other is derived, so they can never drift. "kw" = the
  // slider is truth; "panels" = count × wattage is truth. The latter is how a
  // homeowner who doesn't know the kW rating actually describes their system
  // ("fourteen 400 W panels"), and it works with the panel model left generic.
  const [existSizeBasis, setExistSizeBasis] = useState("kw"); // 'kw' | 'panels'
  const [existPanelCount, setExistPanelCount] = useState(14);
  const [existPanelWCustom, setExistPanelWCustom] = useState(400);

  // battery
  const [battMode, setBattMode] = useState("none"); // 'none' | 'existing' | 'new'
  const [existBattProdId, setExistBattProdId] = useState(""); // "" = not specified / generic
  // Existing storage is counted the way it is installed: N units × capacity
  // each. Replaces a raw total-kWh slider, which asked the rep to do the
  // multiplication and made "two Powerwalls" awkward to express.
  const [existBattUnits, setExistBattUnits] = useState(1);
  const [existBattUnitKwh, setExistBattUnitKwh] = useState(13.5); // per unit, when generic

  // report
  const [customerName, setCustomerName] = useState("");

  // ---- Advanced tab state ----
  const [viewMode, setViewMode] = useState("basic"); // 'basic' | 'advanced'
  const [monthlyUsageKwh, setMonthlyUsageKwh] = useState(Array(12).fill(0));
  const [advOverrides, setAdvOverrides] = useState(ADVANCED_DEFAULTS);
  // multi-system tracker persists per browser (v2: per-entry size basis,
  // panel wattage, and a real inverter-derived derate)
  const [additionalSystems, setAdditionalSystems] = useLocalStorage("sc.res.systems.v2", []);
  const [obstacles, setObstacles] = useState([]);
  // ---- Irradiance engine (Phase 6) ----
  // NASA POWER climatology is the DEFAULT basis, on in both tabs. Basic never
  // renders a control for it — it just quietly powers the numbers once an
  // address is located. Advanced exposes the switch (still default-on) so a
  // rep can drop back to the regional average deliberately.
  const [irradiance, setIrradiance] = useState(null); // NASA POWER record
  const [useIrr, setUseIrr] = useState(true);
  const [irrStatus, setIrrStatus] = useState("idle"); // idle | loading | ok | failed
  // Where the FALLBACK sunHrs came from, so the basis label can tell an
  // Open-Meteo measurement for this address apart from a regional default.
  // Three real sources → three labels; "regional average" must not be claimed
  // for a number that was actually measured.
  const [pshSource, setPshSource] = useState("regional"); // regional | openmeteo
  const [siteFeas, setSiteFeas] = useState({
    availableRoofSqft: 0, roofPsfCapacity: 0,
    mainBreakerAmps: 0, interconnectKw: 0,
    panelWeightLb: 0,
  });
  const [feasibilityAck, setFeasibilityAck] = useState(false); // warnings ack toggle

  // address lookup
  const [address, setAddress] = useState("");
  const [geoState, setGeoState] = useState("idle"); // idle | loading | done | error
  const [geoMsg, setGeoMsg] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [sitePos, setSitePos] = useState(null); // { la, lo } for the aerial roof view
  const [propType, setPropType] = useState(null); // OSM building-tag hint for the located address
  const sugTimer = useRef(null);

  // household loads: id -> { status: 'no' | 'now' | 'future', backup: bool }
  const [loads, setLoads] = useState({});
  const [evMiles, setEvMiles] = useState(12000);
  // custom value overrides: id -> { watts, kwhYr }
  const [loadVals, setLoadVals] = useState({});
  const setLoad = (id, patch) =>
    setLoads((p) => ({ ...p, [id]: { status: "no", backup: false, ...p[id], ...patch } }));
  const setLoadVal = (id, patch) =>
    setLoadVals((p) => ({ ...p, [id]: { ...p[id], ...patch } }));
  const getWatts = (a) => loadVals[a.id]?.watts ?? a.watts;
  const getKwhYr = (a) => (a.ev ? evMiles / EV_MI_PER_KWH : (loadVals[a.id]?.kwhYr ?? a.kwhYr));

  const utility = UTILITIES.find((u) => u.id === utilityId);
  const inverter = INVERTERS.find((i) => i.id === existType);
  const panelProd = ALL_PANEL_PRODUCTS.find((p) => p.id === panelProdId);
  const invProd = INVERTER_PRODUCTS.find((p) => p.id === invProdId);
  const battProd = BATTERY_PRODUCTS.find((p) => p.id === battProdId);
  const panelW = panelProd.watts;
  // recorded existing-system specs (optional — "" = generic)
  const existPanelProd = ALL_PANEL_PRODUCTS.find((p) => p.id === existPanelProdId) || null;
  const existInvProd = ALL_INVERTER_PRODUCTS.find((p) => p.id === existInvProdId) || null;
  const existBattProd = ALL_BATTERY_PRODUCTS.find((p) => p.id === existBattProdId) || null;
  // Existing panel wattage: the real module's spec when a model is recorded,
  // otherwise whatever the rep types. Previously this silently fell back to the
  // NEW array's panel wattage, which had nothing to do with what's on the roof.
  const existPanelW = existPanelProd ? existPanelProd.watts : existPanelWCustom;
  // Effective existing capacity — derived from panels × watts when that's the
  // chosen basis. This is what the model and every readout use.
  const effExistKw = existSizeBasis === "panels"
    ? (existPanelCount * existPanelW) / 1000
    : existKw;
  // Effective existing storage: units × per-unit capacity.
  const existBattUnitSize = existBattProd ? existBattProd.unitKwh : existBattUnitKwh;
  const effBattKwh = existBattUnits * existBattUnitSize;
  const existInverter = existInvProd || inverter; // a recorded inverter model overrides the generic architecture derate
  // label for the existing-panel picker: avoid "Solyndra Solyndra …" when the model name already leads with the brand
  const panelOptLabel = (p) => (p.name.toLowerCase().startsWith(p.mfr.split(" ")[0].toLowerCase()) ? p.name : `${p.mfr} ${p.name}`);

  // Inverter choices for tracked existing arrays — includes legacy and
  // discontinued models, since that is what is actually on an older roof. The
  // selected model supplies that system's derate (already device eff × 0.88).
  const existingInverterOptions = useMemo(() => [
    { label: "Current products", items: INVERTER_PRODUCTS },
    { label: "Legacy (older, still supported)", items: LEGACY_INVERTER_PRODUCTS },
    { label: "Discontinued (no longer sold)", items: DISCONTINUED_INVERTER_PRODUCTS },
  ].filter((g) => g.items?.length), []);

  // apply a configuration preset: sets battery mode/product/units and backup flags
  const applyConfig = (cfg) => {
    setSysConfig(cfg);
    if (cfg === "custom") return;
    const essentials = ["fridge", "lights", "electronics", "medical", "welllpump"];
    const next = { ...loads };
    // make sure there's something active to work with
    const anyActive = APPLIANCES.some((a) => (next[a.id]?.status ?? "no") !== "no");
    if (!anyActive) {
      ["fridge", "lights", "electronics"].forEach((id) => {
        next[id] = { status: "now", backup: false };
      });
    }
    const activeList = APPLIANCES.filter((a) => (next[a.id]?.status ?? "no") !== "no");

    if (cfg === "whole") {
      activeList.forEach((a) => { next[a.id] = { ...next[a.id], backup: true }; });
      setBattProdId("pw3");
      const peakKw = activeList.reduce((s, a) => s + getWatts(a), 0) / 1000;
      setBattUnits(Math.min(4, Math.max(1, Math.ceil(peakKw / 11.5))));
      setBattMode("new");
    } else if (cfg === "partial") {
      activeList.forEach((a) => { next[a.id] = { ...next[a.id], backup: essentials.includes(a.id) || a.backupDefault }; });
      setBattProdId("pw3");
      setBattUnits(1);
      setBattMode("new");
    } else if (cfg === "tou") {
      activeList.forEach((a) => { next[a.id] = { ...next[a.id], backup: false }; });
      setBattProdId("pw3");
      setBattUnits(1);
      setBattMode("new");
    } else if (cfg === "backuponly") {
      activeList.forEach((a) => { next[a.id] = { ...next[a.id], backup: essentials.includes(a.id) || a.backupDefault }; });
      setBattProdId("pw3");
      setBattUnits(1);
      setBattMode("new");
      setPanels(0);
    }
    setLoads(next);
  };

  const pickUtility = (id) => {
    const u = UTILITIES.find((x) => x.id === id);
    setUtilityId(id);
    setStateSel(u.st);
    const sched = getSchedules(u)[0];
    setScheduleId(sched.id);
    setRate(sched.rate ?? u.rate);
    setSunHrs(u.sunHrs);
  };

  const pickSchedule = (sid) => {
    setScheduleId(sid);
    const sched = getSchedules(utility).find((x) => x.id === sid);
    if (sched && sched.rate != null) setRate(sched.rate);
  };

  // change the rate to anything, any time — flips the schedule to Custom
  const setRateCustom = (v) => {
    setRate(v);
    setScheduleId("customrate");
  };

  const pickState = (st) => {
    setStateSel(st);
    const first = UTILITIES.find((u) => u.st === st);
    if (first && utility.st !== st) pickUtility(first.id);
  };

  // ---- address lookup: typed suggestions, then real solar irradiance for the picked site ----
  const onAddressChange = (v) => {
    setAddress(v);
    if (sugTimer.current) clearTimeout(sugTimer.current);
    if (v.trim().length < 4) { setSuggestions([]); return; }
    sugTimer.current = setTimeout(async () => {
      try {
        setSuggestions(await fetchAddressSuggestions(v));
      } catch (err) { console.warn("Address suggestion fetch failed:", err); setSuggestions([]); }
    }, 300);
  };

  const pickSuggestion = (sug) => {
    setAddress(sug.label);
    setSuggestions([]);
    fetchSolarFor(sug.lat, sug.lon, sug.label, sug.state);
  };

  const lookupAddress = async () => {
    if (!address.trim()) return;
    setSuggestions([]);
    setGeoState("loading");
    setGeoMsg("Locating address…");
    try {
      const { lat, lon, formatted, state } = await geocodeAddress(address);
      await fetchSolarFor(lat, lon, formatted, state);
    } catch (err) {
      console.warn("Address lookup failed:", err);
      setGeoState("error");
      setGeoMsg("Couldn't find that address — try adding the city/state, pick a suggestion from the list, or set sun hours manually.");
    }
  };

  const fetchSolarFor = async (la, lo, shortName, stateName) => {
    setSitePos({ la, lo });
    setGeoState("loading");
    setGeoMsg("Pulling a year of solar data for this location…");
    // property-type hint runs in parallel and never blocks the solar data;
    // failures are fine — it's a hint, not a verdict
    setPropType(null);
    onLocated?.(shortName);
    fetchPropertyType(la, lo)
      .then((pt) => setPropType({ ...pt, addr: shortName }))
      .catch((err) => console.warn("Property type lookup failed:", err));

    // Irradiance: fire-and-forget alongside the rest. A failure or timeout
    // silently leaves the model on its existing peak-sun-hours value — never
    // block the calculation or surface a customer-facing error.
    setIrradiance(null);
    setIrrStatus("loading");
    fetchMonthlyGHI(la, lo)
      .then((data) => { setIrradiance(data); setIrrStatus("ok"); })
      .catch((err) => {
        console.warn("NASA POWER fetch failed — staying on regional average:", err);
        setIrrStatus("failed");
      });

    try {
      const { psh } = await fetchPeakSunHours(la, lo);
      setSunHrs(Math.round(psh * 10) / 10);
      setPshSource("openmeteo");

      // rough state + utility territory guess from coordinates
      let guessed = "";
      const g = guessUtility(la, lo, stateName);
      if (g) { pickUtilityKeepSun(g.id, psh); guessed = ` · looks like ${g.label} territory`; }

      setGeoState("done");
      // Deliberately does NOT quote a peak-sun-hours figure. NASA POWER is the
      // active basis when it lands, so asserting the Open-Meteo number here put
      // two different PSH values on screen at once. The irradiance line below
      // owns that claim — one number, one place.
      setGeoMsg(`${shortName}${guessed}`);
    } catch (err) {
      console.warn("Solar data fetch failed:", err);
      setGeoState("error");
      setGeoMsg("Found the address but couldn't pull its solar data — set sun hours manually.");
    }
  };

  const pickUtilityKeepSun = (id, psh) => {
    const u = UTILITIES.find((x) => x.id === id);
    setUtilityId(id);
    setStateSel(u.st);
    const sched = getSchedules(u)[0];
    setScheduleId(sched.id);
    setRate(sched.rate ?? u.rate);
    setSunHrs(Math.round(Math.min(7, Math.max(3, psh)) * 10) / 10);
  };


  // ---- Advanced-tab derived data ----
  // Shade factor: (re)computed only when obstacles or latitude change.
  const shadeFactor = useMemo(() => {
    if (viewMode !== "advanced" || !obstacles.length || !sitePos) return null;
    return shadeFactorForMonths(sitePos.la, sitePos.lo, obstacles);
  }, [viewMode, obstacles, sitePos]);

  // Monthly irradiance basis — deliberately NOT gated on viewMode: NASA is the
  // default basis in Basic too (invisible there), and Advanced's switch is the
  // only way to turn it off.
  const activeMonthlyIrr = (useIrr && irradiance?.monthly) ? irradiance.monthly : null;
  // Advanced overrides are only applied in advanced mode; basic view preserves the CLAUDE.md regression
  const activeOverrides = viewMode === "advanced" ? advOverrides : undefined;
  const activeMonthlyUsage = (viewMode === "advanced" && monthlyUsageKwh.some((v) => v > 0)) ? monthlyUsageKwh : null;
  // Tracked systems are NOT advanced-only — a second array is a fact about the
  // home, not an expert tuning knob. But they ARE gated on hasExisting: the
  // tracker only renders inside that section, and hidden rows must never move
  // the numbers. "Home has existing solar = off" means no existing solar at
  // all, additional arrays included. Blank rows are filtered out by
  // toModelSystems, so an untouched tracker contributes exactly nothing and the
  // Basic default stays on the CLAUDE.md regression.
  const activeAddSystems = useMemo(
    () => (hasExisting ? toModelSystems(additionalSystems, ALL_INVERTER_PRODUCTS) : []),
    [hasExisting, additionalSystems]
  );

  const r = useMemo(() => computeResidential({
    rate, inputMode, annualKwh, bill,
    loads, loadVals, evMiles,
    hasExisting, existKw: effExistKw, existAge, existProdOverride, inverter: existInverter, existPanelW,
    sunHrs, panels, panelW, invProd, sizingBasis, targetKw,
    battMode, battUnits, battProd, battKwh: effBattKwh,
    monthlyUsageKwh: activeMonthlyUsage,
    monthlyIrradiance: activeMonthlyIrr,
    shadeFactor,
    additionalSystems: activeAddSystems,
    overrides: activeOverrides,
  }), [bill, rate, sunHrs, panels, panelW, inputMode, annualKwh, hasExisting, effExistKw, existType, existAge, existProdOverride, existInverter, existPanelW, sizingBasis, targetKw, battMode, effBattKwh, loads, evMiles, loadVals, panelProd, invProd, battProd, battUnits, activeMonthlyUsage, activeMonthlyIrr, shadeFactor, activeAddSystems, activeOverrides]);

  // ---- Feasibility check (advanced view) ----
  const invArch = existType === "micro" ? "micro" : "string";
  const feasibility = useMemo(() => checkFeasibility({
    nPanels: r.nPanels, actualKw: r.actualKw,
    panel: panelProd, inverter: invProd,
    battKwhEff: r.battKwhEff, dailyUsageKwh: r.sizingUsage / 365,
    invArch,
    availableRoofSqft: siteFeas.availableRoofSqft || null,
    panelSqft: (activeOverrides?.panelSqft) ?? PANEL_SQFT,
    panelWeightLb: siteFeas.panelWeightLb || null,
    roofPsfCapacity: siteFeas.roofPsfCapacity || null,
    interconnectKw: siteFeas.interconnectKw || null,
    mainBreakerAmps: siteFeas.mainBreakerAmps || null,
    serviceVoltage: 240,
  }), [r.nPanels, r.actualKw, r.battKwhEff, r.sizingUsage, panelProd, invProd, invArch, siteFeas, activeOverrides]);

  // When the design changes and produces new blockers, clear the acknowledgment
  useEffect(() => { if (feasibility.summary.errors > 0) setFeasibilityAck(false); }, [feasibility.summary.errors]);

  const fmt = (n, d = 0) =>
    n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });

  const cols = 8;
  const shownNew = Math.min(r.nPanels, 48);
  const shownExist = Math.min(r.existPanels, 16);
  const overflow = (r.nPanels - shownNew) + (r.existPanels - shownExist);
  const offsetColor = r.offsetPct >= 95 ? C.green : r.offsetPct >= 60 ? C.gold : C.copper;
  // Existing-solar series must appear whenever there IS existing production —
  // tracked systems (Phase 7) contribute even with the primary card toggled off.
  const showExisting = r.existProd > 0;

  return (
    <>
      <div className="app-screen" style={{ maxWidth: 1040, margin: "0 auto", padding: "0 20px 64px" }}>
        <h1 style={{ fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 700, margin: "4px 0 8px", lineHeight: 1.15 }}>
          From utility bill to rooftop array
        </h1>
        <p style={{ color: C.dim, maxWidth: 620, margin: "0 0 20px", fontSize: 15, lineHeight: 1.6 }}>
          Enter your utility and usage details below. Existing solar and batteries are factored in so the new system covers only what's left.
        </p>

        {/* save report bar */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <input type="text" value={customerName} placeholder="Customer name (for the report)"
            onChange={(e) => setCustomerName(e.target.value)}
            style={{ flex: "1 1 220px", maxWidth: 320, background: C.slate, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 12px", fontSize: 14, fontFamily: "inherit" }} />
          <button onClick={() => window.print()}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 8,
              background: C.gold, border: "none", color: C.night, fontFamily: "inherit",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>
            <Printer size={16} /> Save PDF report
          </button>
          <span className="mono" style={{ fontSize: 11, color: C.dim }}>Opens the print dialog — choose "Save as PDF"</span>
        </div>

        {/* Basic / Advanced view pill */}
        <div role="tablist" aria-label="Detail level" style={{ display: "inline-flex", gap: 3, padding: 3, border: `1px solid ${C.line}`, borderRadius: 999, background: C.slate, marginBottom: 20 }}>
          {[["basic", "Basic", <Home size={13} key="hi" />], ["advanced", "Advanced", <Sliders size={13} key="si" />]].map(([m, label, ic]) => (
            <button key={m} role="tab" aria-selected={viewMode === m} onClick={() => setViewMode(m)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 14px", fontSize: 12.5, fontFamily: "inherit", fontWeight: 600, cursor: "pointer",
                background: viewMode === m ? C.goldSoft : "transparent",
                color: viewMode === m ? C.gold : C.dim,
                border: `1px solid ${viewMode === m ? C.gold : "transparent"}`,
                borderRadius: 999,
              }}>
              {ic}{label}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gap: 24 }}>
          <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>

            {/* ---- inputs ---- */}
            <div style={{ background: C.slate, border: `1px solid ${C.line}`, borderRadius: 14, padding: 24 }}>
              <Field label="Property address" hint="Type to see address suggestions — picking one pulls a year of measured solar data for the exact site">
                <div style={{ position: "relative" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="text" value={address} placeholder="123 Main St, San Diego, CA"
                      onChange={(e) => onAddressChange(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") lookupAddress(); }}
                      onBlur={() => setTimeout(() => setSuggestions([]), 200)}
                      style={{ flex: 1, background: C.night, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 12px", fontSize: 14, fontFamily: "inherit", minWidth: 0 }} />
                    <button onClick={lookupAddress} disabled={geoState === "loading"}
                      style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8,
                        background: C.goldSoft, border: `1px solid ${C.gold}`, color: C.gold,
                        fontFamily: "inherit", fontSize: 13.5, fontWeight: 500, cursor: geoState === "loading" ? "wait" : "pointer", whiteSpace: "nowrap",
                      }}>
                      {geoState === "loading" ? <Loader2 size={15} className="spin" /> : <MapPin size={15} />}
                      Locate
                    </button>
                  </div>
                  {suggestions.length > 0 && (
                    <div style={{
                      position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20,
                      background: C.night, border: `1px solid ${C.gold}66`, borderRadius: 8, overflow: "hidden",
                      boxShadow: "0 8px 24px rgba(0,0,0,.5)",
                    }}>
                      {suggestions.map((sug, i) => (
                        <button key={i} onMouseDown={() => pickSuggestion(sug)}
                          style={{
                            display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
                            padding: "9px 12px", background: "transparent", border: "none",
                            borderTop: i > 0 ? `1px solid ${C.line}` : "none",
                            color: C.text, fontSize: 13, fontFamily: "inherit", cursor: "pointer",
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = C.goldSoft}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                          <MapPin size={13} color={C.gold} style={{ flexShrink: 0 }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sug.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {geoMsg && (
                  <div className="mono" style={{ fontSize: 11.5, marginTop: 8, lineHeight: 1.6, color: geoState === "done" ? C.green : geoState === "error" ? C.copper : C.dim }}>
                    {geoMsg}
                  </div>
                )}
                {sitePos && geoState === "done" && (
                  <div style={{ marginTop: 10 }}>
                    <AerialView la={sitePos.la} lo={sitePos.lo} />
                    <div className="mono" style={{ fontSize: 10.5, color: C.dim, marginTop: 4 }}>Roof view of the located property — check orientation and shading before finalizing panel count</div>
                    {propType?.propertyType === "commercial" && !suppressedAddresses?.has(propType.addr) && (
                      <ModeSuggestionBanner osmLabel={propType.osmLabel} targetMode="commercial"
                        onSwitch={() => { suppressAddress?.(propType.addr); onSwitchMode?.("commercial"); }}
                        onDismiss={() => suppressAddress?.(propType.addr)} />
                    )}
                  </div>
                )}
              </Field>

              <Field label="Where are you located? (state)">
                <select value={stateSel} onChange={(e) => pickState(e.target.value)}
                  style={{ width: "100%", background: C.night, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
                  {STATES.map((st) => <option key={st} value={st}>{st}</option>)}
                </select>
              </Field>

              <RegulationsPanel stateCode={stateSel} />

              <Field label="Power company in your area">
                <select value={utilityId} onChange={(e) => pickUtility(e.target.value)}
                  style={{ width: "100%", background: C.night, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
                  {UTILITIES.filter((u) => u.st === stateSel || u.id === "custom").map((u) => (
                    <option key={u.id} value={u.id}>{u.name} — {u.region}</option>
                  ))}
                </select>
                <div className="mono" style={{ fontSize: 11.5, color: C.dim, marginTop: 8, lineHeight: 1.7 }}>
                  est. ${rate.toFixed(2)}/kWh · {r.effectiveSunHrs.toFixed(1)} sun hrs/day
                  <br />
                  Irradiance:{" "}
                  {r.irradianceBasis === "nasa" ? (
                    <span style={{ color: C.green }}>NASA POWER climatology</span>
                  ) : pshSource === "openmeteo" ? (
                    <span style={{ color: C.gold }}>
                      Open-Meteo measured at this address
                      {irrStatus === "failed" && " — NASA data unavailable"}
                      {irrStatus === "loading" && " — fetching NASA data…"}
                    </span>
                  ) : (
                    <span style={{ color: C.dim }}>
                      regional average
                      {irrStatus === "failed" && " (NASA data unavailable)"}
                      {irrStatus === "loading" && " (fetching NASA data…)"}
                    </span>
                  )}
                </div>
              </Field>

              {/* ---- Advanced-only: measured 12-month usage, alongside the
                     utility it came from. Switching to Advanced is what
                     reveals it; Basic runs on the single annual figure. ---- */}
              {viewMode === "advanced" && (
                <Field label="Monthly kWh usage (Jan–Dec)"
                  hint="Straight off the bill's usage history. Any value above 0 makes these 12 the source of truth and overrides the annual/bill input above. Leave all zeros to keep using it.">
                  <MonthlyUsageGrid values={monthlyUsageKwh}
                    onChange={setMonthlyUsageKwh}
                    annualFallback={r.annualUsage}
                    onFillEven={() => {
                      const base = (inputMode === "kwh" ? annualKwh
                        : inputMode === "loads" ? r.loadsNow
                        : (bill / Math.max(rate, 0.01)) * 12) || annualKwh;
                      setMonthlyUsageKwh(Array(12).fill(Math.round(base / 12)));
                    }}
                    onClear={() => setMonthlyUsageKwh(Array(12).fill(0))} />
                </Field>
              )}

              <Field label="How do you want to enter usage?">
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <Toggle active={inputMode === "bill"} onClick={() => setInputMode("bill")}>Bill $</Toggle>
                  <Toggle active={inputMode === "kwh"} onClick={() => setInputMode("kwh")}>Annual kWh</Toggle>
                  <Toggle active={inputMode === "loads"} onClick={() => setInputMode("loads")}>From loads</Toggle>
                </div>
                {inputMode === "bill" && (
                  <>
                    <div style={{ fontSize: 13, color: C.dim, marginBottom: 8 }}>Total monthly utility bill — usage is estimated from your utility's rate</div>
                    <NumInput prefix="$" value={bill} min={10} max={2000} step={5} onChange={setBill} />
                    <Slider value={bill} min={50} max={1000} step={5} onChange={setBill} />
                  </>
                )}
                {inputMode === "kwh" && (
                  <>
                    <div style={{ fontSize: 13, color: C.dim, marginBottom: 8 }}>Total usage for the year (kWh) — the most accurate way to size a system</div>
                    <NumInput prefix="kWh" value={annualKwh} min={1000} max={50000} step={100} onChange={setAnnualKwh} />
                    <Slider value={annualKwh} min={2000} max={30000} step={100} onChange={setAnnualKwh} />
                    <div className="mono" style={{ fontSize: 11.5, color: C.dim, marginTop: 8 }}>
                      ≈ ${fmt(r.estMonthlyBill)}/mo at ${rate.toFixed(2)}/kWh
                    </div>
                  </>
                )}
                {inputMode === "loads" && (
                  <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.6 }}>
                    Usage builds from the <span style={{ color: C.gold }}>Household Loads</span> table below — mark everything the home runs as "Now".
                    <div className="mono" style={{ fontSize: 11.5, color: C.gold, marginTop: 8 }}>
                      Current total from loads: {fmt(r.annualUsage)} kWh/yr ≈ ${fmt(r.estMonthlyBill)}/mo
                    </div>
                  </div>
                )}
                <div style={{ marginTop: 12, padding: "10px 12px", background: C.night, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 12.5, color: C.dim, lineHeight: 1.6 }}>
                  Find it fast:{" "}
                  {utility.link ? (
                    <a href={utility.link} target="_blank" rel="noopener noreferrer" style={{ color: C.gold, textDecoration: "underline" }}>{utility.linkLabel}</a>
                  ) : (
                    <span style={{ color: C.text }}>your utility's online account</span>
                  )}
                  {" "}→ log in, then open <span style={{ color: C.text }}>Billing & Usage History</span>, download the PDF, and drop it in the uploader above.
                </div>
              </Field>

              <Field label="Rate schedule" hint={(getSchedules(utility).find((x) => x.id === scheduleId) || {}).note || "Pick the customer's plan — or set a custom rate below"}>
                <select value={scheduleId} onChange={(e) => pickSchedule(e.target.value)}
                  style={{ width: "100%", background: C.night, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
                  {getSchedules(utility).map((sch) => (
                    <option key={sch.id} value={sch.id}>{sch.name}{sch.rate != null ? ` — ~$${sch.rate.toFixed(2)}/kWh` : ""}</option>
                  ))}
                </select>
                <div className="mono" style={{ fontSize: 11, color: C.dim, marginTop: 8, lineHeight: 1.7 }}>
                  Rate schedule lookup:{" "}
                  <a href="https://apps.openei.org/USURDB/" target="_blank" rel="noopener noreferrer" style={{ color: C.gold, textDecoration: "underline" }}>OpenEI rate database</a>
                  {" · "}
                  <a href={`https://www.google.com/search?q=${encodeURIComponent(utility.name.split(" (")[0] + " residential rate schedule tariff")}`} target="_blank" rel="noopener noreferrer" style={{ color: C.gold, textDecoration: "underline" }}>search current tariffs</a>
                  {utility.link && (
                    <>
                      {" · "}
                      <a href={utility.link} target="_blank" rel="noopener noreferrer" style={{ color: C.gold, textDecoration: "underline" }}>{utility.name.split(" (")[0]} site</a>
                    </>
                  )}
                </div>
              </Field>

              <Field label={`Rate: $${rate.toFixed(2)}/kWh${scheduleId === "customrate" ? " (custom)" : ""}`}
                hint="Editable any time — adjusting it switches the schedule to Custom">
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <Slider value={rate} min={0.08} max={0.60} step={0.01} onChange={setRateCustom} />
                  </div>
                  <NumInput prefix="$" value={rate} min={0.03} max={2} step={0.01} onChange={setRateCustom} decimals={2} />
                </div>
              </Field>

              {/* ---- existing solar ---- */}
              <Section
                on={hasExisting} setOn={setHasExisting} color={C.green} fill={C.greenSoft}
                icon={<PlusCircle size={16} color={hasExisting ? C.green : C.dim} />}
                title="Home has existing solar">
                <Field label="How do you know the existing system's size?"
                  hint="Don't know the kW rating? Count the panels on the roof and enter their wattage — that's enough to size everything else.">
                  <div style={{ display: "flex", gap: 8 }}>
                    <Toggle active={existSizeBasis === "kw"} onClick={() => setExistSizeBasis("kw")} color={C.green}>System kW</Toggle>
                    <Toggle active={existSizeBasis === "panels"} onClick={() => setExistSizeBasis("panels")} color={C.green}>Panels × watts</Toggle>
                  </div>
                </Field>

                {existSizeBasis === "kw" ? (
                  <Field label={`Existing system size: ${existKw.toFixed(1)} kW`} hint="From the original install docs or inverter monitoring app">
                    <Slider value={existKw} min={1} max={20} step={0.5} onChange={setExistKw} />
                    <div className="mono" style={{ fontSize: 11.5, color: C.dim, marginTop: 6 }}>
                      ≈ {r.existPanels} panels at {existPanelW} W each
                    </div>
                  </Field>
                ) : (
                  <Field label={`Existing array: ${existPanelCount} × ${existPanelW} W = ${effExistKw.toFixed(2)} kW`}
                    hint="Count what's on the roof and enter the wattage off the panel label. The kW rating is computed — no need to look it up.">
                    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                      <MiniInput label="NUMBER OF PANELS" value={existPanelCount} min={1} max={200} step={1} onChange={setExistPanelCount} />
                      {existPanelProd ? (
                        <div>
                          <div className="mono" style={{ fontSize: 10.5, color: C.dim, marginBottom: 3 }}>WATTS PER PANEL</div>
                          <div className="mono" style={{ fontSize: 13, color: C.green, padding: "5px 8px", border: `1px dashed ${C.line}`, borderRadius: 6, width: 78, boxSizing: "border-box" }}>
                            {existPanelW} W
                          </div>
                          <div className="mono" style={{ fontSize: 10, color: C.dim, marginTop: 3 }}>from model</div>
                        </div>
                      ) : (
                        <MiniInput label="WATTS PER PANEL" value={existPanelWCustom} min={50} max={800} step={5} onChange={setExistPanelWCustom} />
                      )}
                    </div>
                    <div className="mono" style={{ fontSize: 11.5, color: C.green, marginTop: 8, lineHeight: 1.6 }}>
                      = {effExistKw.toFixed(2)} kW DC on {existInverter.name ? existInverter.name.toLowerCase() : "the selected"} setup
                    </div>
                  </Field>
                )}
                <Field label="Existing panel model"
                  hint="Record the actual panels on the roof — includes older & discontinued models. Leave it on “Not sure / generic” and you can type the wattage yourself above.">
                  <select value={existPanelProdId} onChange={(e) => setExistPanelProdId(e.target.value)}
                    style={{ width: "100%", background: C.night, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
                    <option value="">Not sure / generic</option>
                    <optgroup label="Current products">
                      {PANEL_PRODUCTS.map((p) => (
                        <option key={p.id} value={p.id}>{panelOptLabel(p)} — {p.watts} W</option>
                      ))}
                    </optgroup>
                    <optgroup label="Legacy (older, still supported)">
                      {LEGACY_PANEL_PRODUCTS.map((p) => (
                        <option key={p.id} value={p.id}>{panelOptLabel(p)} — {p.watts} W</option>
                      ))}
                    </optgroup>
                    <optgroup label="Discontinued (no longer sold)">
                      {DISCONTINUED_PANEL_PRODUCTS.map((p) => (
                        <option key={p.id} value={p.id}>{panelOptLabel(p)} — {p.watts} W</option>
                      ))}
                    </optgroup>
                  </select>
                  {existPanelProd && (
                    <div className="mono" style={{ fontSize: 11.5, color: C.green, marginTop: 4, lineHeight: 1.55 }}>{existPanelProd.note}</div>
                  )}
                </Field>
                <Field label="Inverter architecture">
                  <div style={{ display: "flex", gap: 8 }}>
                    {INVERTERS.map((inv) => (
                      <Toggle key={inv.id} active={existType === inv.id} onClick={() => setExistType(inv.id)} color={C.green}>{inv.name}</Toggle>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: C.dim, marginTop: 8, lineHeight: 1.55 }}>{existInvProd ? "Generic — overridden by the specific model below." : inverter.note}</div>
                </Field>
                <Field label="Existing inverter model" hint="Optional — record the actual inverter (incl. legacy & discontinued). A specific model overrides the architecture above and sets the existing-production derate.">
                  <select value={existInvProdId} onChange={(e) => setExistInvProdId(e.target.value)}
                    style={{ width: "100%", background: C.night, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
                    <option value="">Use architecture above</option>
                    <optgroup label="Current products">
                      {INVERTER_PRODUCTS.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                    </optgroup>
                    <optgroup label="Legacy (older, still supported)">
                      {LEGACY_INVERTER_PRODUCTS.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                    </optgroup>
                    <optgroup label="Discontinued (no longer sold)">
                      {DISCONTINUED_INVERTER_PRODUCTS.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                    </optgroup>
                  </select>
                  {existInvProd && (
                    <div className="mono" style={{ fontSize: 11.5, color: C.green, marginTop: 4, lineHeight: 1.55 }}>{existInvProd.note}</div>
                  )}
                </Field>
                <Field label={`System age: ${existAge} yrs`} hint="Panels lose ~0.5% output per year">
                  <Slider value={existAge} min={0} max={25} step={1} onChange={setExistAge} />
                </Field>
                <Field label="Known annual production (kWh)" hint="Optional — from Enphase/SolarEdge monitoring or the uploaded NEM statement. Leave 0 to estimate.">
                  <NumInput prefix="kWh" value={existProdOverride ?? 0} min={0} max={40000} step={100}
                    onChange={(v) => setExistProdOverride(v > 0 ? v : null)} />
                  <div className="mono" style={{ fontSize: 11.5, color: C.green, marginTop: 4 }}>
                    Existing production: {fmt(r.existProd)} kWh/yr ({fmt(r.existOffsetPct)}% of usage)
                    {activeAddSystems.length > 0 && (
                      <> — includes {activeAddSystems.length} additional tracked system{activeAddSystems.length > 1 ? "s" : ""}</>
                    )}
                  </div>
                </Field>

                {/* ---- additional existing arrays (entries 2..5) ----
                     Lives inside the section so it only appears once the home
                     is marked as having existing solar. Section renders its
                     children only when `on`, and the math is gated on the same
                     flag — see activeAddSystems — so nothing can contribute
                     production while hidden. ---- */}
                <Field label="More than one system?"
                  hint={`The fields above describe the primary array. Add up to ${MAX_SYSTEMS - 1} more — a garage roof, a later expansion on a different inverter. Their production sums into the existing offset. Saved in this browser.`}>
                  <ExistingSystemsPanel
                    systems={additionalSystems}
                    setSystems={setAdditionalSystems}
                    inverterOptions={existingInverterOptions}
                    maxAdditional={MAX_SYSTEMS - 1}
                    primaryCounted
                    aggregateKwh={aggregateProduction(
                      additionalSystems, ALL_INVERTER_PRODUCTS,
                      r.pshDaysYr, activeOverrides?.degradation ?? DEGRADATION
                    )} />
                </Field>
              </Section>

              {/* ---- battery ---- */}
              <div style={{ margin: "0 -24px 22px", padding: "18px 24px", background: battMode !== "none" ? C.tealSoft : "transparent", borderBottom: `1px solid ${C.line}`, transition: "background .25s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <BatteryCharging size={16} color={battMode !== "none" ? C.teal : C.dim} />
                  <span style={{ fontSize: 13.5, fontWeight: 500 }}>Battery storage</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Toggle active={battMode === "none"} onClick={() => setBattMode("none")} color={C.teal}>None</Toggle>
                  <Toggle active={battMode === "existing"} onClick={() => setBattMode("existing")} color={C.teal}>Has existing</Toggle>
                  <Toggle active={battMode === "new"} onClick={() => setBattMode("new")} color={C.teal}>Add new</Toggle>
                </div>
                {battMode !== "none" && (
                  <div style={{ marginTop: 16 }}>
                    {battMode === "new" ? (
                      <>
                        <Field label="Battery product" hint={battProd.note}>
                          <select value={battProdId} onChange={(e) => setBattProdId(e.target.value)}
                            style={{ width: "100%", background: C.night, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
                            {BATTERY_PRODUCTS.map((p) => (
                              <option key={p.id} value={p.id}>{p.name} — {p.unitKwh} kWh / {p.unitKw} kW (~${p.price.toLocaleString()}/unit)</option>
                            ))}
                          </select>
                        </Field>
                        <Field label={`Units: ${battUnits} × ${battProd.unitKwh} kWh = ${r.battKwhEff.toFixed(1)} kWh · ${(battUnits * battProd.unitKw).toFixed(1)} kW output`}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            {[1, 2, 3, 4].map((n) => (
                              <Toggle key={n} active={battUnits === n} onClick={() => setBattUnits(n)} color={C.teal} small>{n} unit{n > 1 ? "s" : ""}</Toggle>
                            ))}
                          </div>
                        </Field>
                      </>
                    ) : (
                      <>
                        <Field label="Existing battery model" hint="Pick the installed battery to record its specs and per-unit capacity — or leave generic and type the kWh per unit below.">
                          <select value={existBattProdId}
                            onChange={(e) => { const id = e.target.value; setExistBattProdId(id); const bp = ALL_BATTERY_PRODUCTS.find((p) => p.id === id); if (bp) setExistBattUnitKwh(bp.unitKwh); }}
                            style={{ width: "100%", background: C.night, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
                            <option value="">Not sure / generic</option>
                            <optgroup label="Current products">
                              {BATTERY_PRODUCTS.map((p) => (
                                <option key={p.id} value={p.id}>{p.name} — {p.unitKwh} kWh{p.unitKw ? ` / ${p.unitKw} kW` : ""}</option>
                              ))}
                            </optgroup>
                            <optgroup label="Legacy (older, still supported)">
                              {LEGACY_BATTERY_PRODUCTS.map((p) => (
                                <option key={p.id} value={p.id}>{p.name} — {p.unitKwh} kWh{p.unitKw ? ` / ${p.unitKw} kW` : ""}</option>
                              ))}
                            </optgroup>
                            <optgroup label="Discontinued (no longer sold)">
                              {DISCONTINUED_BATTERY_PRODUCTS.map((p) => (
                                <option key={p.id} value={p.id}>{p.name} — {p.unitKwh} kWh{p.unitKw ? ` / ${p.unitKw} kW` : ""}</option>
                              ))}
                            </optgroup>
                          </select>
                          {existBattProd && (
                            <div className="mono" style={{ fontSize: 11.5, color: C.teal, marginTop: 4, lineHeight: 1.55 }}>{existBattProd.note}</div>
                          )}
                        </Field>
                        <Field label={`Existing storage: ${existBattUnits} × ${existBattUnitSize} kWh = ${effBattKwh.toFixed(1)} kWh`}
                          hint="Count the units on the wall. Capacity per unit comes from the model above, or type it if the model is generic — Powerwall 3: 13.5 · Enphase 5P: 5.0 · FranklinWH: 15.0">
                          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 10 }}>
                            <MiniInput label="HOW MANY BATTERIES" value={existBattUnits} min={1} max={12} step={1} onChange={setExistBattUnits} />
                            {existBattProd ? (
                              <div>
                                <div className="mono" style={{ fontSize: 10.5, color: C.dim, marginBottom: 3 }}>kWh PER UNIT</div>
                                <div className="mono" style={{ fontSize: 13, color: C.teal, padding: "5px 8px", border: `1px dashed ${C.line}`, borderRadius: 6, width: 78, boxSizing: "border-box" }}>
                                  {existBattProd.unitKwh}
                                </div>
                                <div className="mono" style={{ fontSize: 10, color: C.dim, marginTop: 3 }}>from model</div>
                              </div>
                            ) : (
                              <MiniInput label="kWh PER UNIT" value={existBattUnitKwh} min={1} max={60} step={0.5} onChange={setExistBattUnitKwh} />
                            )}
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {[1, 2, 3, 4].map((n) => (
                              <Toggle key={n} active={existBattUnits === n} onClick={() => setExistBattUnits(n)} color={C.teal} small>{n} unit{n > 1 ? "s" : ""}</Toggle>
                            ))}
                          </div>
                          <div className="mono" style={{ fontSize: 11.5, color: C.teal, marginTop: 10 }}>
                            Total usable storage on site: {effBattKwh.toFixed(1)} kWh
                          </div>
                        </Field>
                      </>
                    )}
                    <div className="mono" style={{ fontSize: 11.5, color: C.teal, lineHeight: 1.8 }}>
                      Backup: ~{fmt(r.backupHours)} hrs at avg load · shifts {fmt(r.shiftable)} kWh/yr of surplus
                      <br />Self-consumption value: ~${fmt(r.battSavings)}/yr vs exporting at ${EXPORT_RATE.toFixed(2)}/kWh
                      {battMode === "new" && <><br />Adds ${fmt(r.battCost)} to system cost (before 30% ITC)</>}
                    </div>
                  </div>
                )}
              </div>

              <Field label="Size the system by" hint="Energy sizes the array to cover your kWh usage. Power lets you dial in a target wattage directly — the panel below compares both.">
                <div style={{ display: "flex", gap: 8 }}>
                  <Toggle active={sizingBasis === "energy"} onClick={() => { setSizingBasis("energy"); setPanels(null); }}>Energy · kWh usage</Toggle>
                  <Toggle active={sizingBasis === "power"} onClick={() => { setSizingBasis("power"); setPanels(null); }}>Power · target kW</Toggle>
                </div>
              </Field>

              {sizingBasis === "power" ? (
                <Field label={`Target system size: ${targetKw.toFixed(1)} kW`}
                  hint={`≈ ${r.sizePower.panels} panels × ${panelW} W · produces ~${fmt(r.sizePower.prod)} kWh/yr · ${fmt(Math.min(r.sizePower.offsetPct, 999))}% offset`}>
                  <Slider value={targetKw} min={1} max={20} step={0.5} onChange={(v) => { setTargetKw(v); setPanels(null); }} />
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button onClick={() => { setTargetKw(Math.round(r.sizeEnergy.kw * 2) / 2); setPanels(null); }}
                      style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.dim, borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                      Match my usage ({fmt(r.sizeEnergy.kw, 1)} kW)
                    </button>
                  </div>
                </Field>
              ) : (
                <Field label={`New array: ${r.nPanels} panels`}
                  hint={panels === null
                    ? (hasExisting ? "Auto-sized to cover the remaining usage — drag to explore" : "Auto-sized to cover 100% of usage — drag to explore")
                    : `Auto size: ${r.autoPanels} panels`}>
                  <Slider value={r.nPanels} min={0} max={Math.max(48, r.autoPanels + 12)} step={1} onChange={(v) => setPanels(v)} />
                  {panels !== null && (
                    <button onClick={() => setPanels(null)}
                      style={{ marginTop: 8, background: "transparent", border: `1px solid ${C.line}`, color: C.dim, borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                      Reset to auto size
                    </button>
                  )}
                </Field>
              )}

              <Field label="Panel product" hint={panelProd.note}>
                <select value={panelProdId} onChange={(e) => setPanelProdId(e.target.value)}
                  style={{ width: "100%", background: C.night, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
                  {[...new Set(PANEL_PRODUCTS.map((p) => p.mfr))].map((m) => (
                    <optgroup key={m} label={m}>
                      {PANEL_PRODUCTS.filter((p) => p.mfr === m).map((p) => (
                        <option key={p.id} value={p.id}>{p.name} — {p.watts} W · {p.eff}%</option>
                      ))}
                    </optgroup>
                  ))}
                  {[...new Set(LEGACY_PANEL_PRODUCTS.map((p) => p.mfr))].map((m) => (
                    <optgroup key={`legacy-${m}`} label={`${m} — legacy (older / discontinued)`}>
                      {LEGACY_PANEL_PRODUCTS.filter((p) => p.mfr === m).map((p) => (
                        <option key={p.id} value={p.id}>{p.name} — {p.watts} W · {p.eff}%</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>

              <Field label="Inverter system (new array)" hint={invProd.note}>
                <select value={invProdId} onChange={(e) => setInvProdId(e.target.value)}
                  style={{ width: "100%", background: C.night, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
                  {INVERTER_PRODUCTS.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — {p.deviceEff}% device / {Math.round(p.derate * 1000) / 10}% system</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* ---- array + offset ---- */}
            <div style={{ background: C.slate, border: `1px solid ${C.line}`, borderRadius: 14, padding: 24, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span className="mono" style={{ fontSize: 12, letterSpacing: 2, color: C.dim }}>YOUR SYSTEM</span>
                <span className="mono" style={{ fontSize: 13, color: C.gold }}>
                  {hasExisting && `${r.existPanels} existing + `}{r.nPanels} new · {fmt(r.actualKw + (hasExisting ? effExistKw : 0), 1)} kW
                </span>
              </div>

              <div style={{ margin: "10px 0 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: C.dim }}>{hasExisting ? "Combined bill offset" : "Estimated bill offset"}</span>
                  <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: offsetColor }}>{fmt(Math.min(r.offsetPct, 999))}%</span>
                </div>
                <div style={{ height: 10, borderRadius: 5, background: C.night, border: `1px solid ${C.line}`, overflow: "hidden", display: "flex" }}>
                  {hasExisting && (
                    <div style={{ width: `${Math.min(r.existOffsetPct, 100)}%`, height: "100%", background: C.green, transition: "width .3s ease" }} />
                  )}
                  <div style={{ width: `${Math.max(Math.min(r.offsetPct, 100) - (hasExisting ? Math.min(r.existOffsetPct, 100) : 0), 0)}%`, height: "100%", background: `linear-gradient(90deg, ${C.copper}, ${C.gold})`, transition: "width .3s ease" }} />
                </div>
                {hasExisting && (
                  <div className="mono" style={{ fontSize: 11.5, color: C.dim, marginTop: 5 }}>
                    <span style={{ color: C.green }}>■</span> existing {fmt(r.existOffsetPct)}% &nbsp;
                    <span style={{ color: C.gold }}>■</span> new +{fmt(r.newOffsetPct)}%
                  </div>
                )}
                {r.offsetPct > 105 && (
                  <div className="mono" style={{ fontSize: 11.5, color: C.green, marginTop: 5 }}>
                    Producing {fmt(r.offsetPct - 100)}% more than the home uses{battMode !== "none" ? " — the battery captures surplus that would otherwise export cheap" : " — surplus may earn export credits"}
                  </div>
                )}
              </div>

              {/* ---- energy ⇄ power sizing comparison + how energy flows (technical) ---- */}
              <div style={{ margin: "0 0 16px", padding: 14, background: C.night, border: `1px solid ${C.line}`, borderRadius: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span className="mono" style={{ fontSize: 11, letterSpacing: 1.5, color: C.dim }}>SIZING · ENERGY ⇄ POWER</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => { setSizingBasis("energy"); setPanels(null); }}
                      style={{ fontFamily: "inherit", fontSize: 11.5, cursor: "pointer", borderRadius: 6, padding: "4px 10px", border: `1px solid ${sizingBasis === "energy" ? C.gold : C.line}`, background: sizingBasis === "energy" ? C.gold : "transparent", color: sizingBasis === "energy" ? C.night : C.dim }}>kWh</button>
                    <button onClick={() => { setSizingBasis("power"); setPanels(null); }}
                      style={{ fontFamily: "inherit", fontSize: 11.5, cursor: "pointer", borderRadius: 6, padding: "4px 10px", border: `1px solid ${sizingBasis === "power" ? C.gold : C.line}`, background: sizingBasis === "power" ? C.gold : "transparent", color: sizingBasis === "power" ? C.night : C.dim }}>kW</button>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={{ padding: 10, borderRadius: 8, background: sizingBasis === "energy" ? C.greenSoft : "transparent", border: `1px solid ${sizingBasis === "energy" ? C.green : C.line}` }}>
                    <div style={{ fontSize: 11, color: C.dim, marginBottom: 2 }}>By kWh usage</div>
                    <div className="mono" style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{fmt(r.sizeEnergy.kw, 1)} kW</div>
                    <div className="mono" style={{ fontSize: 11.5, color: C.dim, lineHeight: 1.75, marginTop: 3 }}>
                      {r.sizeEnergy.panels} panels<br />{fmt(r.sizeEnergy.prod)} kWh/yr<br />{fmt(Math.min(r.sizeEnergy.offsetPct, 999))}% offset
                    </div>
                  </div>
                  <div style={{ padding: 10, borderRadius: 8, background: sizingBasis === "power" ? C.tealSoft : "transparent", border: `1px solid ${sizingBasis === "power" ? C.teal : C.line}` }}>
                    <div style={{ fontSize: 11, color: C.dim, marginBottom: 2 }}>By target watts</div>
                    <div className="mono" style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{fmt(r.sizePower.kw, 1)} kW</div>
                    <div className="mono" style={{ fontSize: 11.5, color: C.dim, lineHeight: 1.75, marginTop: 3 }}>
                      {r.sizePower.panels} panels<br />{fmt(r.sizePower.prod)} kWh/yr<br />{fmt(Math.min(r.sizePower.offsetPct, 999))}% offset
                    </div>
                  </div>
                </div>
                <div className="mono" style={{ fontSize: 11, color: C.dim, marginTop: 10, lineHeight: 1.85 }}>
                  Δ {fmt(Math.abs(r.sizePower.kw - r.sizeEnergy.kw), 1)} kW · {r.sizePower.prod >= r.sizeEnergy.prod ? "+" : "−"}{fmt(Math.abs(r.sizePower.prod - r.sizeEnergy.prod))} kWh/yr between the two<br />
                  <span style={{ color: C.text }}>Energy flow:</span> 1 kW × {sunHrs.toFixed(1)} sun-h × {fmt(invProd.derate * 100, 0)}% derate × 365 = {fmt(r.kwhPerKwYr)} kWh per kW·yr<br />
                  {fmt(r.sizingUsage)} kWh/yr usage ÷ {fmt(r.kwhPerKwYr)} = {fmt(r.sizeEnergy.kw, 1)} kW to fully offset · this array {fmt(r.actualKw, 1)} kW → {fmt(r.newProd)} kWh/yr
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 5, flex: 1, alignContent: "start" }}>
                {Array.from({ length: shownExist }).map((_, i) => (
                  <div key={`e-${shownExist}-${i}`} className="cell" title="Existing panel"
                    style={{ aspectRatio: "1 / 1.4", borderRadius: 3, background: "linear-gradient(160deg, #2E5E48, #1D3D30)", border: `1px solid ${C.green}55`, animationDelay: `${i * 10}ms` }} />
                ))}
                {Array.from({ length: shownNew }).map((_, i) => (
                  <div key={`n-${shownNew}-${i}`} className="cell" title="New panel"
                    style={{ aspectRatio: "1 / 1.4", borderRadius: 3, background: `linear-gradient(160deg, ${C.cellLit}, ${C.cell})`, border: `1px solid ${C.line}`, animationDelay: `${(shownExist + i) * 10}ms` }} />
                ))}
              </div>
              <div className="mono" style={{ fontSize: 11.5, color: C.dim, marginTop: 10 }}>
                {hasExisting && <><span style={{ color: C.green }}>■</span> existing &nbsp; <span style={{ color: "#4A6E9C" }}>■</span> new &nbsp;</>}
                {battMode !== "none" && <span style={{ color: C.teal }}>▮ {r.battKwhEff.toFixed(1)} kWh battery{battMode === "existing" ? " (existing)" : ` (${battUnits} × ${battProd.name})`}</span>}
              </div>
              {overflow > 0 && <div className="mono" style={{ fontSize: 12, color: C.dim, marginTop: 6 }}>+ {overflow} more panels</div>}

              {/* battery units */}
              {battMode !== "none" && (() => {
                const unitSize = battMode === "new" ? battProd.unitKwh : 13.5;
                const unitCount = battMode === "new" ? battUnits : existBattUnits;
                const total = r.battKwhEff;
                return (
                  <div style={{ marginTop: 16 }}>
                    <div className="mono" style={{ fontSize: 11, letterSpacing: 1.5, color: C.teal, marginBottom: 8 }}>
                      {battMode === "new" ? battProd.name.toUpperCase() : "EXISTING BATTERY"} — {unitCount} × {unitSize} kWh unit{unitCount > 1 ? "s" : ""} ({total.toFixed(1)} kWh)
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {Array.from({ length: unitCount }).map((_, i) => {
                        const fillPct = Math.min(Math.max(total - i * unitSize, 0) / unitSize, 1) * 100;
                        return (
                          <div key={`b-${total}-${i}`} className="cell" title={`Unit ${i + 1}`}
                            style={{
                              width: 34, height: 58, borderRadius: 5, position: "relative", overflow: "hidden",
                              background: C.night, border: `1.5px solid ${C.teal}`, animationDelay: `${i * 60}ms`,
                            }}>
                            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${fillPct}%`, background: `linear-gradient(180deg, ${C.teal}, ${C.teal}88)` }} />
                            <div className="mono" style={{ position: "absolute", top: 3, left: 0, right: 0, textAlign: "center", fontSize: 8.5, color: C.text }}>
                              {fillPct < 100 ? `${(total - i * unitSize).toFixed(1)}` : unitSize}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* exact equipment list */}
              <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 8, background: C.night, border: `1px solid ${C.line}` }}>
                <div className="mono" style={{ fontSize: 11, letterSpacing: 1.5, color: C.dim, marginBottom: 6 }}>EXACT EQUIPMENT TO POWER THIS HOME</div>
                <div className="mono" style={{ fontSize: 12.5, lineHeight: 1.9 }}>
                  <span style={{ color: C.gold }}>▸ {r.nPanels} × {panelProd.mfr} {panelProd.name} ({panelW} W)</span> = {fmt(r.actualKw, 1)} kW new solar
                  {r.nPanels > 0 && <><br /><span style={{ color: C.gold }}>▸ {invProd.name}</span></>}
                  {hasExisting && <><br /><span style={{ color: C.green }}>▸ {r.existPanels} panels existing{existPanelProd ? ` × ${panelOptLabel(existPanelProd)}` : ` × ${existPanelW} W`}</span> = {effExistKw.toFixed(1)} kW already on the roof</>}
                  {hasExisting && existInvProd && <><br /><span style={{ color: C.green }}>▸ {existInvProd.name}</span> (existing inverter)</>}
                  {battMode !== "none" && (battMode === "new"
                    ? <><br /><span style={{ color: C.teal }}>▸ {battUnits} × {battProd.name}</span> = {r.battKwhEff.toFixed(1)} kWh / {(battUnits * battProd.unitKw).toFixed(1)} kW output (new)</>
                    : <><br /><span style={{ color: C.teal }}>▸ {existBattUnits} × {existBattUnitSize} kWh existing battery{existBattProd ? ` (${existBattProd.name})` : ""}</span> = {effBattKwh.toFixed(1)} kWh</>)}
                  <br /><span style={{ color: C.dim }}>▸ Covers {fmt(Math.min(r.offsetPct, 999))}% of {fmt(r.sizingUsage)} kWh/yr{r.loadsFuture > 0 ? " (incl. future loads)" : ""}</span>
                </div>
              </div>

              <div className="mono" style={{ fontSize: 12, color: C.dim, marginTop: 10 }}>New array needs ≈ {fmt(r.roofArea)} sq ft of roof</div>
            </div>
          </div>

          {/* ---- Advanced controls (Feature 1: every parameter editable) ---- */}
          {viewMode === "advanced" && (
            <div style={{ background: C.slate, border: `1px solid ${C.gold}44`, borderRadius: 14, padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, justifyContent: "space-between", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Sliders size={16} color={C.gold} />
                  <span className="mono" style={{ fontSize: 12, letterSpacing: 2, color: C.gold }}>ADVANCED PARAMETERS</span>
                </div>
                <button onClick={() => setAdvOverrides(ADVANCED_DEFAULTS)}
                  style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.dim, borderRadius: 6, padding: "5px 10px", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>
                  Reset all to defaults
                </button>
              </div>
              <p style={{ fontSize: 13, color: C.dim, margin: "0 0 16px", lineHeight: 1.6 }}>
                Every calculation constant editable. Changes take effect immediately and update all downstream numbers. Prices remain estimates — replace with distributor pricing before quoting.
              </p>

              {/* Feature 6: NASA POWER irradiance */}
              <div style={{ padding: 14, background: C.night, border: `1px solid ${C.line}`, borderRadius: 10, marginBottom: 18 }}>
                <div className="mono" style={{ fontSize: 11, letterSpacing: 1.5, color: C.dim, marginBottom: 10 }}>SITE IRRADIANCE (NASA POWER)</div>
                <p style={{ fontSize: 12.5, color: C.dim, margin: "0 0 12px", lineHeight: 1.6 }}>
                  Free, keyless monthly irradiance from NASA's POWER climatology, fetched automatically
                  when an address is located and used <strong style={{ color: C.text }}>by default</strong>.
                  It sets the peak-sun-hours basis for both the annual total and the month-by-month split.
                  Turning it off falls back to the utility's regional average. This replaces the sun-hours
                  assumption only — the system derate is a separate loss stage and does not change.
                </p>
                <IrradiancePanel sitePos={sitePos}
                  irradiance={irradiance} setIrradiance={setIrradiance}
                  useIrr={useIrr} setUseIrr={setUseIrr}
                  status={irrStatus} setStatus={setIrrStatus} />
              </div>

              {/* Feature 5: shading obstacles */}
              <div style={{ padding: 14, background: C.night, border: `1px solid ${C.line}`, borderRadius: 10, marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Trees size={14} color={C.dim} />
                  <span className="mono" style={{ fontSize: 11, letterSpacing: 1.5, color: C.dim }}>SHADING OBSTACLES</span>
                </div>
                <p style={{ fontSize: 12.5, color: C.dim, margin: "0 0 12px", lineHeight: 1.6 }}>
                  Add trees, buildings, and chimneys with height and direction from the array. A monthly shade-loss factor computes via sun-position math (NOAA algorithm) and reduces new-system production accordingly.
                </p>
                <ShadingEditor obstacles={obstacles} setObstacles={setObstacles}
                  shadeFactor={shadeFactor || Array(12).fill(0)}
                  hasLocation={!!sitePos} />
              </div>

              {/* Site inputs for feasibility (Feature 4) */}
              <div style={{ padding: 14, background: C.night, border: `1px solid ${C.line}`, borderRadius: 10, marginBottom: 18 }}>
                <div className="mono" style={{ fontSize: 11, letterSpacing: 1.5, color: C.dim, marginBottom: 10 }}>SITE-SPECIFIC INPUTS (feasibility)</div>
                <p style={{ fontSize: 12.5, color: C.dim, margin: "0 0 12px", lineHeight: 1.6 }}>
                  Optional inputs that unlock additional feasibility checks below. Leave 0 to skip that check.
                </p>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                  <SiteInput label="Available roof (sq ft)" value={siteFeas.availableRoofSqft}
                    onChange={(v) => setSiteFeas({ ...siteFeas, availableRoofSqft: v })} />
                  <SiteInput label="Roof capacity (psf)" value={siteFeas.roofPsfCapacity}
                    onChange={(v) => setSiteFeas({ ...siteFeas, roofPsfCapacity: v })} />
                  <SiteInput label="Panel weight (lb ea.)" value={siteFeas.panelWeightLb}
                    onChange={(v) => setSiteFeas({ ...siteFeas, panelWeightLb: v })} />
                  <SiteInput label="Main breaker (A)" value={siteFeas.mainBreakerAmps}
                    onChange={(v) => setSiteFeas({ ...siteFeas, mainBreakerAmps: v })} />
                  <SiteInput label="Interconnect cap (kW)" value={siteFeas.interconnectKw}
                    onChange={(v) => setSiteFeas({ ...siteFeas, interconnectKw: v })} />
                </div>
              </div>

              {/* Feature 1 (continued): calc constants */}
              <div style={{ padding: 14, background: C.night, border: `1px solid ${C.line}`, borderRadius: 10 }}>
                <div className="mono" style={{ fontSize: 11, letterSpacing: 1.5, color: C.dim, marginBottom: 10 }}>CALCULATION CONSTANTS</div>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                  <ConstInput label="Cost per watt ($/W)" value={advOverrides.costPerWatt}
                    step={0.05} min={0.5} max={6} decimals={2}
                    onChange={(v) => setAdvOverrides({ ...advOverrides, costPerWatt: v })} />
                  <ConstInput label="Federal ITC (%)" value={advOverrides.taxCredit * 100}
                    step={1} min={0} max={50} decimals={0}
                    onChange={(v) => setAdvOverrides({ ...advOverrides, taxCredit: v / 100 })} />
                  <ConstInput label="Panel degradation (%/yr)" value={advOverrides.degradation * 100}
                    step={0.1} min={0} max={2} decimals={2}
                    onChange={(v) => setAdvOverrides({ ...advOverrides, degradation: v / 100 })} />
                  <ConstInput label="Utility escalation (%/yr)" value={advOverrides.rateEscalation * 100}
                    step={0.5} min={0} max={10} decimals={1}
                    onChange={(v) => setAdvOverrides({ ...advOverrides, rateEscalation: v / 100 })} />
                  <ConstInput label="Export rate ($/kWh)" value={advOverrides.exportRate}
                    step={0.01} min={0} max={1} decimals={2}
                    onChange={(v) => setAdvOverrides({ ...advOverrides, exportRate: v })} />
                  <ConstInput label="Panel footprint (sqft)" value={advOverrides.panelSqft}
                    step={1} min={10} max={40} decimals={0}
                    onChange={(v) => setAdvOverrides({ ...advOverrides, panelSqft: v })} />
                  <ConstInput label="Battery round-trip (%)" value={advOverrides.battEff * 100}
                    step={1} min={70} max={99} decimals={0}
                    onChange={(v) => setAdvOverrides({ ...advOverrides, battEff: v / 100 })} />
                  <ConstInput label="Battery daily cycles (%)" value={advOverrides.battUtil * 100}
                    step={5} min={20} max={100} decimals={0}
                    onChange={(v) => setAdvOverrides({ ...advOverrides, battUtil: v / 100 })} />
                  <ConstInput label="Solar-hour usage share (%)" value={advOverrides.solarHourShare * 100}
                    step={5} min={10} max={90} decimals={0}
                    onChange={(v) => setAdvOverrides({ ...advOverrides, solarHourShare: v / 100 })} />
                </div>
                <div className="mono" style={{ fontSize: 11, color: C.dim, marginTop: 10, lineHeight: 1.7 }}>
                  Defaults match the constants in <code>src/data/constants.js</code>. Deviating from them here changes THIS session's math only — the file's defaults are the CLAUDE.md verified regression baseline.
                </div>
              </div>
            </div>
          )}

          {/* ---- system configuration ---- */}
          <div style={{ background: C.slate, border: `1px solid ${C.line}`, borderRadius: 14, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Zap size={16} color={C.gold} />
              <span className="mono" style={{ fontSize: 12, letterSpacing: 2, color: C.dim }}>SYSTEM CONFIGURATION</span>
            </div>
            <p style={{ fontSize: 13, color: C.dim, margin: "0 0 16px", lineHeight: 1.6 }}>
              Pick the configuration that matches how the customer will use the system — it sets the battery product, unit count, and backup plan automatically. Everything stays adjustable afterward.
            </p>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              {SYS_CONFIGS.map((c) => (
                <button key={c.id} onClick={() => applyConfig(c.id)}
                  style={{
                    textAlign: "left", padding: "16px 16px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                    background: sysConfig === c.id ? C.goldSoft : C.night,
                    border: `1.5px solid ${sysConfig === c.id ? C.gold : C.line}`,
                    transition: "border-color .15s, background .15s",
                  }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: sysConfig === c.id ? C.gold : C.text, marginBottom: 6 }}>{c.name}</div>
                  <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.55, marginBottom: 8 }}>{c.blurb}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: sysConfig === c.id ? C.gold : "#5B7292", lineHeight: 1.5 }}>{c.sets}</div>
                </button>
              ))}
            </div>
            {sysConfig !== "custom" && (
              <div className="mono" style={{ fontSize: 11.5, color: C.dim, marginTop: 12 }}>
                Applied: <span style={{ color: C.gold }}>{SYS_CONFIGS.find((c) => c.id === sysConfig)?.name}</span> — tweak any setting to fine-tune; changes won't reset until another configuration is picked.
              </div>
            )}
          </div>

          {/* ---- household loads + backup statement ---- */}
          <div style={{ background: C.slate, border: `1px solid ${C.line}`, borderRadius: 14, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Plug size={16} color={C.gold} />
              <span className="mono" style={{ fontSize: 12, letterSpacing: 2, color: C.dim }}>HOUSEHOLD LOADS & FUTURE ADDITIONS</span>
            </div>
            <p style={{ fontSize: 13, color: C.dim, margin: "0 0 16px", lineHeight: 1.6 }}>
              Mark <span style={{ color: C.text }}>Now</span> for what the home runs today{inputMode === "loads" ? " (this builds the usage total)" : " (informational — it's already in the bill)"}, and <span style={{ color: C.gold }}>Later</span> for planned additions like an EV — the system is sized ahead for them.
              {battMode !== "none" && <> Tap the <ShieldCheck size={13} style={{ display: "inline", verticalAlign: "-2px" }} /> shield to include a load in the battery backup plan.</>}
            </p>

            <div style={{ display: "grid", gap: 6 }}>
              {APPLIANCES.map((a) => {
                const l = loads[a.id] || { status: "no", backup: false };
                const active = l.status !== "no";
                const w = getWatts(a);
                const annual = Math.round(getKwhYr(a));
                return (
                  <div key={a.id} style={{
                    display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                    padding: "9px 12px", borderRadius: 8,
                    background: active ? (l.status === "future" ? C.goldSoft : "#1A2C46") : "transparent",
                    border: `1px solid ${active ? (l.status === "future" ? C.gold + "66" : C.line) : "transparent"}`,
                  }}>
                    <div style={{ flex: "1 1 170px", minWidth: 150 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{a.name}</div>
                      <div className="mono" style={{ fontSize: 11, color: C.dim }}>
                        {fmt(w)} W · ~{fmt(annual)} kWh/yr
                      </div>
                    </div>

                    {active && (
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <MiniInput label="Watts" value={w} min={10} max={20000} step={50}
                          onChange={(v) => setLoadVal(a.id, { watts: v })} />
                        {a.ev ? (
                          <div style={{ minWidth: 140 }}>
                            <div className="mono" style={{ fontSize: 10.5, color: C.dim, marginBottom: 3 }}>{fmt(evMiles)} mi/yr → {fmt(annual)} kWh</div>
                            <Slider value={evMiles} min={4000} max={30000} step={1000} onChange={setEvMiles} />
                          </div>
                        ) : (
                          <MiniInput label="kWh/yr" value={annual} min={0} max={20000} step={50}
                            onChange={(v) => setLoadVal(a.id, { kwhYr: v })} />
                        )}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: "auto" }}>
                      <select value={l.status}
                        onChange={(e) => {
                          const s = e.target.value;
                          setLoad(a.id, { status: s, backup: s === "no" ? false : (l.status === "no" ? a.backupDefault : l.backup) });
                        }}
                        style={{
                          background: C.night, color: l.status === "future" ? C.gold : l.status === "now" ? C.text : C.dim,
                          border: `1px solid ${l.status === "future" ? C.gold : l.status === "now" ? "#4A6E9C" : C.line}`,
                          borderRadius: 8, padding: "7px 10px", fontSize: 13, fontFamily: "inherit", cursor: "pointer",
                        }}>
                        <option value="no">No</option>
                        <option value="now">Now</option>
                        <option value="future">Later</option>
                      </select>
                      <button title="Include in battery backup" disabled={battMode === "none" || !active}
                        onClick={() => setLoad(a.id, { backup: !l.backup })}
                        style={{
                          padding: "6px 9px", borderRadius: 8, cursor: battMode === "none" || !active ? "not-allowed" : "pointer",
                          background: l.backup && active && battMode !== "none" ? C.tealSoft : "transparent",
                          border: `1px solid ${l.backup && active && battMode !== "none" ? C.teal : C.line}`,
                          opacity: battMode === "none" || !active ? 0.35 : 1,
                        }}>
                        <ShieldCheck size={15} color={l.backup && active && battMode !== "none" ? C.teal : C.dim} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mono" style={{ fontSize: 12, color: C.dim, marginTop: 14 }}>
              Current loads: <span style={{ color: C.text }}>{fmt(r.loadsNow)} kWh/yr</span>
              {r.loadsFuture > 0 && <> · Future additions: <span style={{ color: C.gold }}>+{fmt(r.loadsFuture)} kWh/yr</span> → system sized for <span style={{ color: C.gold }}>{fmt(r.sizingUsage)} kWh/yr</span></>}
            </div>

            {/* backup load statement */}
            {battMode !== "none" && r.backupLoads.length > 0 && (
              <div style={{ marginTop: 18, padding: "16px 18px", borderRadius: 10, background: C.tealSoft, border: `1px solid ${C.teal}55` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <ShieldCheck size={15} color={C.teal} />
                  <span className="mono" style={{ fontSize: 11.5, letterSpacing: 2, color: C.teal }}>BACKUP LOAD STATEMENT — {r.battKwhEff.toFixed(1)} kWh {battMode === "new" ? battProd.name.toUpperCase() : "BATTERY"}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginBottom: 10 }}>
                  {r.backupLoads.map((a) => (
                    <span key={a.id} className="mono" style={{ fontSize: 12, color: C.text }}>
                      {a.name} <span style={{ color: C.dim }}>({fmt(a.watts)} W)</span>
                    </span>
                  ))}
                </div>
                <div className="mono" style={{ fontSize: 12, lineHeight: 1.9 }}>
                  <span style={{ color: r.backupOk ? C.green : C.copper }}>
                    Peak backed-up load: {(r.backupWatts / 1000).toFixed(1)} kW vs ~{r.invKw.toFixed(1)} kW inverter output — {r.backupOk ? "OK, battery can carry all of these at once" : "EXCEEDS output — stagger heavy loads or add battery capacity"}
                  </span>
                  <br />
                  <span style={{ color: C.teal }}>
                    Estimated runtime on these loads: ~{fmt(Math.min(r.backupHrsCritical, 999))} hrs on a full charge (longer with sun recharging by day)
                  </span>
                  {r.backupLoads.some((a) => a.ev) && (
                    <>
                      <br />
                      <span style={{ color: C.copper }}>Note: EV charging drains a home battery fast — most backup plans exclude it or limit it to solar hours.</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ---- production over time ---- */}
          <div style={{ background: C.slate, border: `1px solid ${C.line}`, borderRadius: 14, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
              <span className="mono" style={{ fontSize: 12, letterSpacing: 2, color: C.dim }}>PRODUCTION OVER TIME</span>
              <div style={{ display: "flex", gap: 8 }}>
                <Toggle active={chartView === "monthly"} onClick={() => setChartView("monthly")} small>Monthly production</Toggle>
                <Toggle active={chartView === "savings"} onClick={() => setChartView("savings")} small>25-year savings</Toggle>
              </div>
            </div>

            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                {chartView === "monthly" ? (
                  <ComposedChart data={r.monthly} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke={C.line} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: C.dim, fontSize: 12 }} axisLine={{ stroke: C.line }} tickLine={false} />
                    <YAxis tick={{ fill: C.dim, fontSize: 12 }} axisLine={false} tickLine={false} unit=" kWh" width={72} />
                    <Tooltip contentStyle={{ background: C.night, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13 }} labelStyle={{ color: C.text }}
                      formatter={(v, name) => [`${v.toLocaleString()} kWh`, name]} />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    {showExisting && <Bar dataKey="existing" name="Existing solar" stackId="solar" fill={C.green} />}
                    <Bar dataKey="newSolar" name="New solar" stackId="solar" fill={C.gold} radius={[3, 3, 0, 0]} />
                    <Line dataKey="usage" name="Home usage" stroke={C.copper} strokeWidth={2.5} dot={{ r: 3, fill: C.copper }} />
                  </ComposedChart>
                ) : (
                  <AreaChart data={r.savings} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="savedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.green} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={C.green} stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={C.line} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="year" tick={{ fill: C.dim, fontSize: 12 }} axisLine={{ stroke: C.line }} tickLine={false} label={{ value: "Years", fill: C.dim, fontSize: 12, dy: 14 }} />
                    <YAxis tick={{ fill: C.dim, fontSize: 12 }} axisLine={false} tickLine={false} width={80} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ background: C.night, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13 }} labelStyle={{ color: C.text }}
                      labelFormatter={(y) => `Year ${y}`} formatter={(v, name) => [`$${v.toLocaleString()}`, name]} />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    <Area dataKey="saved" name="Cumulative savings (new equipment)" stroke={C.green} strokeWidth={2.5} fill="url(#savedGrad)" />
                    <ReferenceLine y={r.netCost} stroke={C.gold} strokeDasharray="6 4"
                      label={{ value: `New system cost $${fmt(r.netCost)}`, fill: C.gold, fontSize: 12, position: "insideTopRight" }} />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
            <p className="mono" style={{ fontSize: 11.5, color: C.dim, margin: "12px 0 0" }}>
              {chartView === "monthly"
                ? (hasExisting ? "Stacked bars: green = existing output, gold = new panels — together vs the home's usage curve." : "Summer months produce ~1.7× more than December. Usage curve reflects typical AC-driven summer demand.")
                : `New equipment only (solar${battMode === "new" ? " + battery" : ""}). Rates rise ${RATE_ESCALATION * 100}%/yr, panels degrade 0.5%/yr. Break-even ~${fmt(r.payback, 1)} yrs.`}
            </p>
          </div>

          {/* ---- results ---- */}
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <Stat icon={<Percent size={16} color={offsetColor} />} label={hasExisting ? "Combined offset" : "Bill offset"} value={`${fmt(Math.min(r.offsetPct, 999))}%`}
              sub={hasExisting ? `${fmt(r.existOffsetPct)}% existing + ${fmt(r.newOffsetPct)}% new` : `of ${fmt(r.sizingUsage)} kWh/yr${r.loadsFuture > 0 ? " incl. future loads" : ""}`} accent={offsetColor} />
            {r.loadsFuture > 0 && (
              <Stat icon={<Plug size={16} color={C.gold} />} label="Future loads sized in" value={`+${fmt(r.loadsFuture)} kWh`} sub="planned additions (EV, etc.)" accent={C.gold} />
            )}
            <Stat icon={<Zap size={16} color={C.gold} />} label="New system size" value={`${fmt(r.actualKw, 1)} kW`} sub={`${r.nPanels} × ${panelW} W panels`} />
            {hasExisting && (
              <Stat icon={<Sun size={16} color={C.green} />} label="Existing production" value={`${fmt(r.existProd)} kWh`} sub={`${effExistKw.toFixed(1)} kW ${inverter.name.toLowerCase()}, ${existAge} yrs old`} accent={C.green} />
            )}
            {battMode !== "none" && (
              <Stat icon={<BatteryCharging size={16} color={C.teal} />} label={battMode === "new" ? "New battery" : "Existing battery"} value={`${r.battKwhEff.toFixed(1)} kWh`}
                sub={`~${fmt(r.backupHours)} hrs backup · +$${fmt(r.battSavings)}/yr value`} accent={C.teal} />
            )}
            <Stat icon={<DollarSign size={16} color={C.gold} />} label="New equipment cost (after ITC)" value={`$${fmt(r.netCost)}`}
              sub={`$${fmt(r.grossCost)} gross${battMode === "new" ? " incl. battery" : ""}`} />
            <Stat icon={<Sun size={16} color={C.gold} />} label="Payback period" value={r.payback > 0 ? `${fmt(r.payback, 1)} yrs` : "—"} sub={`new equipment saves ~$${fmt(r.annualSavings)}/yr`} />
            <Stat icon={<TrendingUp size={16} color={C.green} />} label="25-year savings" value={`$${fmt(r.savings25)}`} sub="new equipment, with rate escalation" accent={C.green} />
          </div>

          <p style={{ color: C.dim, fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
            Battery value assumes NEM 3.0-style economics: surplus exported to the grid earns ~${EXPORT_RATE.toFixed(2)}/kWh, so storing it and using it in the evening at the retail rate is where batteries pay off ({Math.round(BATT_EFF * 100)}% round-trip efficiency; unit prices from the product catalog, ITC-eligible). Panel, inverter, and battery specs (watts, efficiency, warranty, output) come from your product database (v17e, current products only). Prices are NOT in that database, so costs use editable estimates ($2.75/W solar, ~$1,000/kWh battery) — replace with distributor pricing before quoting. Existing-system estimates use inverter-specific efficiency and 0.5%/yr degradation — actual monitoring data beats estimates every time. AI-extracted bill data should be reviewed before quoting. A site survey will refine everything.
          </p>

          {/* ---- Feature 4: Feasibility panel (always visible; site-specific rules only fire when the Advanced-tab inputs are filled) ---- */}
          <div style={{ background: C.slate, border: `1px solid ${feasibility.summary.errors > 0 ? C.copper : C.line}`, borderRadius: 14, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Gauge size={16} color={feasibility.summary.errors > 0 ? C.copper : C.green} />
              <span className="mono" style={{ fontSize: 12, letterSpacing: 2, color: C.dim }}>BUILD FEASIBILITY</span>
            </div>
            <p style={{ fontSize: 13, color: C.dim, margin: "0 0 16px", lineHeight: 1.6 }}>
              A sanity screen for common site-design mistakes. Site-specific rules (roof area, service size, interconnect cap) fire only when their inputs are supplied in the Advanced tab.
            </p>
            <FeasibilityPanel result={feasibility} />
            {feasibility.summary.errors > 0 && (
              <div style={{ marginTop: 14, padding: "10px 14px", background: "#3B1E1233", border: `1px solid ${C.copper}`, borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span className="mono" style={{ fontSize: 12, color: C.copper }}>
                  Blockers present — proposal is not build-ready until they are resolved{feasibilityAck ? " (acknowledged for this session)" : ""}.
                </span>
                {!feasibilityAck && (
                  <button onClick={() => setFeasibilityAck(true)}
                    style={{ background: "transparent", border: `1px solid ${C.copper}`, color: C.copper, borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                    Acknowledge and continue
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---- customer PDF report (print only) ---- */}
      <div className="print-report">
        <div style={{ borderBottom: "3px solid #F5B62E", paddingBottom: 10, marginBottom: 18 }}>
          <div className="mono" style={{ fontSize: 11, letterSpacing: 3, color: "#946A0E" }}>SOLAR + STORAGE ESTIMATE</div>
          <div style={{ fontSize: 26, fontWeight: 700, margin: "4px 0" }}>System Proposal</div>
          <div style={{ fontSize: 12.5, color: "#444" }}>
            Prepared for: <b>{customerName || "________________"}</b> &nbsp;·&nbsp; {address || "Address on file"} &nbsp;·&nbsp; {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>

        {sitePos && (
          <div style={{ marginBottom: 14 }}>
            <AerialView la={sitePos.la} lo={sitePos.lo} height={190} />
          </div>
        )}

        <div style={{ fontSize: 13, lineHeight: 1.7 }}>
          <div style={{ fontWeight: 700, fontSize: 14, borderBottom: "1px solid #ccc", marginBottom: 6 }}>Site & Usage</div>
          <div>
            Utility: <b>{utility.name}</b>{(() => { const sch = getSchedules(utility).find((x) => x.id === scheduleId); return sch && sch.id !== "customrate" ? ` — ${sch.name}` : " — custom rate"; })()} at ~${rate.toFixed(2)}/kWh · Solar resource: <b>{sunHrs} peak sun hrs/day</b><br />
            Current usage: <b>{fmt(r.annualUsage)} kWh/yr</b> (≈ ${fmt(r.estMonthlyBill)}/mo)
            {r.loadsFuture > 0 && <> · Planned additions: <b>+{fmt(r.loadsFuture)} kWh/yr</b> → designed for <b>{fmt(r.sizingUsage)} kWh/yr</b></>}
          </div>

          <div style={{ fontWeight: 700, fontSize: 14, borderBottom: "1px solid #ccc", margin: "14px 0 6px" }}>Recommended System{sysConfig !== "custom" && <> — {SYS_CONFIGS.find((c) => c.id === sysConfig)?.name}</>}</div>
          <div>
            {r.nPanels > 0 && <>• <b>{r.nPanels} × {panelProd.mfr} {panelProd.name}</b> ({panelW} W, {panelProd.eff}% efficiency) = <b>{fmt(r.actualKw, 1)} kW</b> new solar<br /></>}
            {r.nPanels > 0 && <>• <b>{invProd.name}</b> — {invProd.deviceEff}% device efficiency<br /></>}
            {hasExisting && <>• Existing: {r.existPanels} panels × {existPanelW} W ({effExistKw.toFixed(1)} kW, {inverter.name.toLowerCase()}, {existAge} yrs) producing ~{fmt(r.existProd)} kWh/yr<br /></>}
            {battMode === "new" && <>• <b>{battUnits} × {battProd.name}</b> = {r.battKwhEff.toFixed(1)} kWh storage / {(battUnits * battProd.unitKw).toFixed(1)} kW output<br /></>}
            {battMode === "existing" && <>• Existing battery: {existBattUnits} × {existBattUnitSize} kWh = {effBattKwh.toFixed(1)} kWh{existBattProd ? ` (${existBattProd.name})` : ""}<br /></>}
            • Estimated bill offset: <b>{fmt(Math.min(r.offsetPct, 999))}%</b> · New array roof area: ~{fmt(r.roofArea)} sq ft
          </div>

          {battMode !== "none" && r.backupLoads.length > 0 && (
            <>
              <div style={{ fontWeight: 700, fontSize: 14, borderBottom: "1px solid #ccc", margin: "14px 0 6px" }}>Backup Load Statement</div>
              <div>
                Backed-up loads: {r.backupLoads.map((a) => `${a.name} (${fmt(a.watts)} W)`).join(", ")}<br />
                Peak backed-up load: <b>{(r.backupWatts / 1000).toFixed(1)} kW</b> vs {r.invKw.toFixed(1)} kW battery output — <b>{r.backupOk ? "supported simultaneously" : "exceeds output; stagger heavy loads or add capacity"}</b><br />
                Estimated runtime on a full charge: <b>~{fmt(Math.min(r.backupHrsCritical, 999))} hours</b> (longer with daytime solar recharge)
              </div>
            </>
          )}

          <div style={{ fontWeight: 700, fontSize: 14, borderBottom: "1px solid #ccc", margin: "14px 0 6px" }}>Investment & Savings</div>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
            <tbody>
              <tr><td style={{ padding: "3px 0" }}>System cost (before incentives)</td><td style={{ textAlign: "right" }}><b>${fmt(r.grossCost)}</b></td></tr>
              <tr><td style={{ padding: "3px 0" }}>Federal tax credit (30% ITC)</td><td style={{ textAlign: "right" }}>−${fmt(r.grossCost * TAX_CREDIT)}</td></tr>
              <tr style={{ borderTop: "1px solid #ccc" }}><td style={{ padding: "3px 0" }}><b>Net investment</b></td><td style={{ textAlign: "right" }}><b>${fmt(r.netCost)}</b></td></tr>
              <tr><td style={{ padding: "3px 0" }}>First-year savings</td><td style={{ textAlign: "right" }}>${fmt(r.annualSavings + r.battSavings)}/yr</td></tr>
              <tr><td style={{ padding: "3px 0" }}>Estimated payback</td><td style={{ textAlign: "right" }}>{r.payback > 0 ? `${fmt(r.payback, 1)} years` : "—"}</td></tr>
              <tr><td style={{ padding: "3px 0" }}>25-year savings (4%/yr rate escalation)</td><td style={{ textAlign: "right" }}><b>${fmt(r.savings25)}</b></td></tr>
            </tbody>
          </table>

          <div style={{ fontWeight: 700, fontSize: 14, borderBottom: "1px solid #ccc", margin: "14px 0 6px" }}>Estimated Monthly Production (kWh)</div>
          <table className="mono" style={{ borderCollapse: "collapse", width: "100%", fontSize: 10.5, textAlign: "right" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #999" }}>
                <th style={{ textAlign: "left" }}>Month</th>{showExisting && <th>Existing</th>}<th>New solar</th><th>Usage</th><th>Offset</th>
              </tr>
            </thead>
            <tbody>
              {r.monthly.map((m) => (
                <tr key={m.month}>
                  <td style={{ textAlign: "left", padding: "1px 0" }}>{m.month}</td>
                  {showExisting && <td>{fmt(m.existing)}</td>}
                  <td>{fmt(m.newSolar)}</td><td>{fmt(m.usage)}</td>
                  <td>{fmt(((m.existing + m.newSolar) / Math.max(m.usage, 1)) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ fontSize: 10, color: "#555", marginTop: 16, lineHeight: 1.5, borderTop: "1px solid #ccc", paddingTop: 8 }}>
            This is a preliminary estimate, not a binding quote. Production modeled from{" "}
            {r.irradianceBasis === "nasa"
              ? `NASA POWER climatology for this location (${r.effectiveSunHrs.toFixed(1)} peak sun hrs/day annual average)`
              : pshSource === "openmeteo"
              ? `Open-Meteo irradiance measured at this address (${r.effectiveSunHrs.toFixed(1)} peak sun hrs/day)`
              : `a regional peak-sun-hours average (${r.effectiveSunHrs.toFixed(1)} hrs/day — not measured at this address)`}
            , {Math.round(invProd.derate * 100)}% system output after real-world losses, and{" "}
            {((activeOverrides?.degradation ?? DEGRADATION) * 100).toFixed(1)}%/yr panel degradation.
            Costs use estimated installed pricing (${(activeOverrides?.costPerWatt ?? COST_PER_WATT).toFixed(2)}/W solar;
            battery per selected product) and assume {Math.round((activeOverrides?.taxCredit ?? TAX_CREDIT) * 100)}% federal
            ITC eligibility — consult a tax professional. Utility rates, export credits, and incentives change; final design
            and pricing follow a site survey and engineering review.
          </div>
        </div>
      </div>
    </>
  );
}

