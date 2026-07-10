import { useState, useMemo, useRef } from "react";
import { Sun, Zap, DollarSign, Percent, TrendingUp, PlusCircle, BatteryCharging, FileUp, Loader2, CheckCircle2, XCircle, MapPin, Plug, ShieldCheck, Printer } from "lucide-react";
import {
  ComposedChart, Bar, Line, Area, AreaChart, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, ReferenceLine,
} from "recharts";


import { C, MONTHS, SEASON, DAYS, USE_SEASON, SCALE_TOTAL, DERATE, COST_PER_WATT, TAX_CREDIT, PANEL_SQFT, RATE_ESCALATION, DEGRADATION, EXPORT_RATE, BATT_EFF, BATT_UTIL, SOLAR_HOUR_SHARE, BATT_COST_KWH, BATT_KW_PER_KWH, EV_MI_PER_KWH } from "./data/constants.js";
import { STATES, STATE_CODES, UTILITIES, INVERTERS, RATE_SCHEDULES, getSchedules } from "./data/utilities.js";
import { PANEL_PRODUCTS, INVERTER_PRODUCTS, BATTERY_PRODUCTS } from "./data/products.js";
import { APPLIANCES } from "./data/appliances.js";
import { SYS_CONFIGS } from "./data/configs.js";

export default function SolarCalculator() {
  const [stateSel, setStateSel] = useState("CA");
  const [utilityId, setUtilityId] = useState("sdge");
  const [scheduleId, setScheduleId] = useState("toudr1");
  const [inputMode, setInputMode] = useState("bill");
  const [annualKwh, setAnnualKwh] = useState(8400);
  const [bill, setBill] = useState(280);
  const [rate, setRate] = useState(UTILITIES[0].rate);
  const [sunHrs, setSunHrs] = useState(UTILITIES[0].sunHrs);
  const [panels, setPanels] = useState(null);
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

  // battery
  const [battMode, setBattMode] = useState("none"); // 'none' | 'existing' | 'new'
  const [battKwh, setBattKwh] = useState(13.5);

  // PDF ingestion
  const [scanState, setScanState] = useState("idle"); // idle | loading | done | error
  const [scanMsg, setScanMsg] = useState("");
  const fileRef = useRef(null);

  // report
  const [customerName, setCustomerName] = useState("");

  // address lookup
  const [address, setAddress] = useState("");
  const [geoState, setGeoState] = useState("idle"); // idle | loading | done | error
  const [geoMsg, setGeoMsg] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [sitePos, setSitePos] = useState(null); // { la, lo } for the aerial roof view
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
  const panelProd = PANEL_PRODUCTS.find((p) => p.id === panelProdId);
  const invProd = INVERTER_PRODUCTS.find((p) => p.id === invProdId);
  const battProd = BATTERY_PRODUCTS.find((p) => p.id === battProdId);
  const panelW = panelProd.watts;

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
    // debounced single search (respects Nominatim's no-heavy-autocomplete policy)
    sugTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=us&addressdetails=1&q=${encodeURIComponent(v)}`
        ).then((x) => x.json());
        setSuggestions((res || []).map((g) => ({
          label: g.display_name.split(",").slice(0, 4).join(","),
          lat: parseFloat(g.lat), lon: parseFloat(g.lon),
          state: g.address?.state || null,
        })));
      } catch (err) { console.warn("Address suggestion fetch failed:", err); setSuggestions([]); }
    }, 700);
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
      const geo = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&addressdetails=1&q=${encodeURIComponent(address)}`
      ).then((x) => x.json());
      if (!geo?.length) throw new Error("not found");
      const { lat, lon, display_name } = geo[0];
      await fetchSolarFor(parseFloat(lat), parseFloat(lon), display_name.split(",").slice(0, 3).join(","), geo[0].address?.state || null);
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
    try {
      // last full calendar year of daily solar radiation (MJ/m²)
      const yr = new Date().getFullYear() - 1;
      const met = await fetch(
        `https://archive-api.open-meteo.com/v1/archive?latitude=${la}&longitude=${lo}&start_date=${yr}-01-01&end_date=${yr}-12-31&daily=shortwave_radiation_sum&timezone=auto`
      ).then((x) => x.json());
      const days = met?.daily?.shortwave_radiation_sum?.filter((v) => v != null) || [];
      if (!days.length) throw new Error("no solar data");
      const annualKwhM2 = days.reduce((s, v) => s + v, 0) / 3.6; // MJ→kWh
      const psh = Math.min(7, Math.max(3, annualKwhM2 / days.length));
      setSunHrs(Math.round(psh * 10) / 10);

      // rough state + utility territory guess from coordinates
      let guessed = "";
      const guess = (id, label) => { pickUtilityKeepSun(id, psh); guessed = ` · looks like ${label} territory`; };
      if (lo >= -125 && lo < -114.1 && la >= 32.4 && la <= 42.1) {
        // California
        if (la < 33.6 && lo > -118) guess("sdge", "SDG&E");
        else if (la >= 38.3 && la <= 38.9 && lo >= -121.7 && lo <= -121.0) guess("smud", "SMUD");
        else if (la < 35.0) guess("sce", "SCE");
        else guess("pge", "PG&E");
      } else if (lo >= -114.9 && lo <= -109.0 && la >= 31.3 && la <= 37.0) {
        // Arizona
        if (la < 32.6 && lo > -111.5) guess("tep", "TEP");
        else guess("aps", "APS / SRP");
      } else if (lo >= -109.1 && lo <= -102.0 && la >= 36.9 && la <= 41.1) {
        // Colorado
        if (la >= 38.6 && la <= 39.1 && lo >= -105.1 && lo <= -104.5) guess("csu", "Colorado Springs Utilities");
        else guess("xcel", "Xcel Energy");
      } else if (stateName && STATE_CODES[stateName]) {
        // anywhere else in the USA: geocoder tells us the state; default to its major utility
        const first = UTILITIES.find((u) => u.st === STATE_CODES[stateName]);
        if (first) guess(first.id, `${stateName} — defaulted to ${first.name}, confirm below`);
      }

      setGeoState("done");
      setGeoMsg(`${shortName} — measured ${psh.toFixed(1)} peak sun hrs/day (${yr} data)${guessed}`);
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


  const handlePdf = async (file) => {
    if (!file) return;
    setScanState("loading");
    setScanMsg("Reading the bill…");
    try {
      const base64 = await new Promise((res, rej) => {
        const rd = new FileReader();
        rd.onload = () => res(rd.result.split(",")[1]);
        rd.onerror = () => rej(new Error("Could not read file"));
        rd.readAsDataURL(file);
      });

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
              {
                type: "text",
                text: `This is a residential utility bill (likely SDG&E or PG&E). Extract these values and respond with ONLY a JSON object, no markdown, no backticks, no other text:
{
  "utility": "SDG&E" | "PG&E" | "SCE" | "SMUD" | "LADWP" | "APS" | "SRP" | "TEP" | "Xcel" | "Colorado Springs Utilities" | "Black Hills" | "Other" | null,
  "monthly_bill_total": number | null,       // total amount due in dollars
  "monthly_kwh": number | null,              // kWh used this billing period
  "annual_kwh": number | null,               // 12-month usage if shown (usage history chart/table)
  "avg_rate": number | null,                 // $/kWh if derivable (total charges / kWh)
  "existing_solar_kw": number | null,        // solar system size if mentioned (NEM statement)
  "existing_solar_annual_kwh": number | null,// annual solar generation if shown
  "battery_kwh": number | null               // battery capacity if mentioned
}
Use null for anything not found. Numbers only, no units or symbols.`
              },
            ],
          }],
        }),
      });

      const data = await response.json();
      const text = data.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());

      const applied = [];
      const utilMap = { "SDG&E": "sdge", "PG&E": "pge", "SCE": "sce", "SMUD": "smud", "LADWP": "ladwp", "APS": "aps", "SRP": "srp", "TEP": "tep", "Xcel": "xcel", "Colorado Springs Utilities": "csu", "Black Hills": "bhe" };
      if (parsed.utility && utilMap[parsed.utility]) { pickUtility(utilMap[parsed.utility]); applied.push(`utility: ${parsed.utility}`); }
      if (parsed.avg_rate && parsed.avg_rate > 0.05 && parsed.avg_rate < 1) { setRate(parsed.avg_rate); setScheduleId("customrate"); applied.push(`rate $${parsed.avg_rate.toFixed(2)}/kWh (custom)`); }
      if (parsed.annual_kwh && parsed.annual_kwh > 500) {
        setAnnualKwh(Math.round(parsed.annual_kwh)); setInputMode("kwh");
        applied.push(`${Math.round(parsed.annual_kwh).toLocaleString()} kWh/yr`);
      } else if (parsed.monthly_kwh && parsed.monthly_kwh > 50) {
        setAnnualKwh(Math.round(parsed.monthly_kwh * 12)); setInputMode("kwh");
        applied.push(`${Math.round(parsed.monthly_kwh)} kWh/mo → annualized`);
      } else if (parsed.monthly_bill_total && parsed.monthly_bill_total > 10) {
        setBill(Math.round(parsed.monthly_bill_total)); setInputMode("bill");
        applied.push(`bill $${Math.round(parsed.monthly_bill_total)}`);
      }
      if (parsed.existing_solar_kw && parsed.existing_solar_kw > 0) {
        setHasExisting(true); setExistKw(parsed.existing_solar_kw);
        applied.push(`existing solar ${parsed.existing_solar_kw} kW`);
      }
      if (parsed.existing_solar_annual_kwh && parsed.existing_solar_annual_kwh > 0) {
        setHasExisting(true); setExistProdOverride(Math.round(parsed.existing_solar_annual_kwh));
        applied.push(`solar production ${Math.round(parsed.existing_solar_annual_kwh).toLocaleString()} kWh/yr`);
      }
      if (parsed.battery_kwh && parsed.battery_kwh > 0) {
        setBattMode("existing"); setBattKwh(parsed.battery_kwh);
        applied.push(`battery ${parsed.battery_kwh} kWh`);
      }

      if (applied.length) {
        setScanState("done");
        setScanMsg(`Pulled from bill: ${applied.join(" · ")}`);
      } else {
        setScanState("error");
        setScanMsg("Couldn't find usable numbers in that PDF — enter them manually or try a clearer bill.");
      }
    } catch (err) {
      setScanState("error");
      setScanMsg("Something went wrong reading the PDF. Enter the numbers manually.");
    }
  };

  const r = useMemo(() => {
    const safeRate = Math.max(rate, 0.01);

    // household loads (respecting custom value overrides)
    const loadKwh = (a) => getKwhYr(a);
    let loadsNow = 0, loadsFuture = 0;
    APPLIANCES.forEach((a) => {
      const s = loads[a.id]?.status;
      if (s === "now") loadsNow += loadKwh(a);
      if (s === "future") loadsFuture += loadKwh(a);
    });

    // current usage from the chosen source
    const baseUsage =
      inputMode === "loads" ? Math.max(loadsNow, 500)
      : inputMode === "kwh" ? annualKwh
      : (bill / safeRate) * 12;
    const annualUsage = baseUsage;
    // size the system for current usage PLUS planned future loads
    const sizingUsage = annualUsage + loadsFuture;
    const monthlyKwh = annualUsage / 12;
    const estMonthlyBill = monthlyKwh * safeRate;

    // existing solar
    let existProd = 0;
    if (hasExisting) {
      const eff = inverter.derate * Math.pow(1 - DEGRADATION, existAge);
      existProd = existProdOverride ?? existKw * sunHrs * eff * 365;
    }
    const existOffsetPct = (existProd / sizingUsage) * 100;
    const existPanels = hasExisting ? Math.round((existKw * 1000) / panelW) : 0;

    // new system covers the remainder (incl. future loads)
    const remainingKwh = Math.max(sizingUsage - existProd, 0);
    const autoKw = (remainingKwh / 365) / (sunHrs * invProd.derate);
    const autoPanels = Math.ceil((autoKw * 1000) / panelW);
    const nPanels = panels ?? autoPanels;
    const actualKw = (nPanels * panelW) / 1000;
    const newProd = actualKw * sunHrs * invProd.derate * 365;
    const newOffsetPct = (newProd / sizingUsage) * 100;
    const combinedProd = existProd + newProd;
    const offsetPct = (combinedProd / sizingUsage) * 100;

    // battery: new = units × selected product; existing = entered kWh
    const hasBatt = battMode !== "none";
    const battKwhEff = battMode === "new" ? battUnits * battProd.unitKwh : battKwh;
    const daytimeSurplus = Math.max(combinedProd - sizingUsage * SOLAR_HOUR_SHARE, 0);
    const shiftable = hasBatt ? Math.min(battKwhEff * 365 * BATT_UTIL, daytimeSurplus) : 0;
    const battSavings = shiftable * BATT_EFF * Math.max(safeRate - EXPORT_RATE, 0);
    const avgLoadKw = sizingUsage / 8760;
    const backupHours = hasBatt && avgLoadKw > 0 ? battKwhEff / avgLoadKw : 0;
    const battCost = battMode === "new" ? battUnits * battProd.price : 0;

    // backup load statement: which selected loads the battery carries in an outage
    const backupLoads = APPLIANCES.filter((a) => {
      const l = loads[a.id];
      return l && l.status !== "no" && l.backup;
    }).map((a) => ({ ...a, watts: getWatts(a), annual: loadKwh(a) }));
    const backupWatts = backupLoads.reduce((s, a) => s + a.watts, 0);
    const backupDailyKwh = backupLoads.reduce((s, a) => s + a.annual, 0) / 365;
    const invKw = battMode === "new" ? battUnits * battProd.unitKw : battKwhEff * BATT_KW_PER_KWH;
    const backupOk = backupWatts / 1000 <= invKw;
    const backupHrsCritical = hasBatt && backupDailyKwh > 0 ? (battKwhEff * 0.9) / backupDailyKwh * 24 : 0;

    // costs & savings (new equipment only)
    const grossCost = actualKw * 1000 * COST_PER_WATT + battCost;
    const netCost = grossCost * (1 - TAX_CREDIT);
    const billedBefore = Math.max(sizingUsage - existProd, 0);
    const billedAfter = Math.max(sizingUsage - combinedProd, 0);
    const solarSavings = (billedBefore - billedAfter) * safeRate;
    const newBattSavings = battMode === "new" ? battSavings : 0; // only count toward payback if buying it
    const annualSavings = solarSavings + newBattSavings;
    const payback = annualSavings > 0 && netCost > 0 ? netCost / annualSavings : 0;
    const roofArea = nPanels * PANEL_SQFT;

    const monthly = MONTHS.map((m, i) => {
      const scale = (DAYS[i] * SEASON[i]) / SCALE_TOTAL;
      return {
        month: m,
        existing: Math.round(existProd * scale),
        newSolar: Math.round(newProd * scale),
        usage: Math.round((sizingUsage / 12) * USE_SEASON[i]),
      };
    });

    let cum = 0;
    const savings = [];
    for (let y = 0; y <= 25; y++) {
      if (y > 0) {
        const yearRate = safeRate * Math.pow(1 + RATE_ESCALATION, y - 1);
        const deg = Math.pow(1 - DEGRADATION, y - 1);
        const before = Math.max(sizingUsage - existProd * deg, 0);
        const after = Math.max(sizingUsage - combinedProd * deg, 0);
        const battY = newBattSavings * Math.pow(1 + RATE_ESCALATION, y - 1);
        cum += (before - after) * yearRate + battY;
      }
      savings.push({ year: y, saved: Math.round(cum), cost: Math.round(netCost) });
    }

    return {
      monthlyKwh, annualUsage, sizingUsage, loadsNow, loadsFuture, estMonthlyBill,
      nPanels, autoPanels, actualKw,
      existProd, existOffsetPct, existPanels, newProd, newOffsetPct, offsetPct,
      battSavings, backupHours, battCost, shiftable, battKwhEff,
      backupLoads, backupWatts, backupDailyKwh, invKw, backupOk, backupHrsCritical,
      grossCost, netCost, annualSavings, payback, roofArea, monthly, savings, savings25: cum,
    };
  }, [bill, rate, sunHrs, panels, panelW, inputMode, annualKwh, hasExisting, existKw, existType, existAge, existProdOverride, inverter, battMode, battKwh, loads, evMiles, loadVals, panelProd, invProd, battProd, battUnits]);

  const fmt = (n, d = 0) =>
    n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });

  const cols = 8;
  const shownNew = Math.min(r.nPanels, 48);
  const shownExist = Math.min(r.existPanels, 16);
  const overflow = (r.nPanels - shownNew) + (r.existPanels - shownExist);
  const offsetColor = r.offsetPct >= 95 ? C.green : r.offsetPct >= 60 ? C.gold : C.copper;

  return (
    <div className="app-root" style={{ minHeight: "100vh", background: C.night, color: C.text, fontFamily: "'Space Grotesk', 'Segoe UI', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
        input[type=range] { -webkit-appearance: none; width: 100%; height: 4px; border-radius: 2px; background: ${C.line}; outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: ${C.gold}; cursor: pointer; border: 3px solid ${C.night}; box-shadow: 0 0 0 2px ${C.gold}; }
        input[type=range]::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: ${C.gold}; cursor: pointer; border: 3px solid ${C.night}; box-shadow: 0 0 0 2px ${C.gold}; }
        input[type=number] { -moz-appearance: textfield; }
        input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; }
        .mono { font-family: 'IBM Plex Mono', monospace; }
        @keyframes cellIn { from { opacity: 0; transform: scale(.7); } to { opacity: 1; transform: scale(1); } }
        .cell { animation: cellIn .25s ease both; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .cell, .spin { animation: none; } }
        button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid ${C.gold}; outline-offset: 2px; }
        .print-report { display: none; }
        @media print {
          @page { margin: 12mm; }
          .app-root { background: #fff !important; min-height: 0 !important; }
          .app-screen { display: none !important; }
          .print-report { display: block !important; color: #111; font-family: Georgia, 'Times New Roman', serif; }
          .print-report .mono { font-family: 'Courier New', monospace; }
        }
      `}</style>

      <div className="app-screen" style={{ maxWidth: 1040, margin: "0 auto", padding: "40px 20px 64px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <Sun size={26} color={C.gold} />
          <span className="mono" style={{ fontSize: 12, letterSpacing: 3, color: C.gold }}>SOLAR SIZING WORKSHEET</span>
        </div>
        <h1 style={{ fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 700, margin: "4px 0 8px", lineHeight: 1.15 }}>
          From utility bill to rooftop array
        </h1>
        <p style={{ color: C.dim, maxWidth: 620, margin: "0 0 20px", fontSize: 15, lineHeight: 1.6 }}>
          Upload the customer's bill to auto-fill, or enter everything manually. Existing solar and batteries are factored in so the new system covers only what's left.
        </p>

        {/* save report bar */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
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

        {/* ---- PDF upload ---- */}
        <div style={{
          marginBottom: 28, padding: "16px 18px", borderRadius: 12,
          border: `1.5px dashed ${scanState === "done" ? C.green : scanState === "error" ? C.copper : C.line}`,
          background: C.slate, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        }}>
          <input ref={fileRef} type="file" accept="application/pdf" style={{ display: "none" }}
            onChange={(e) => handlePdf(e.target.files?.[0])} />
          <button onClick={() => fileRef.current?.click()} disabled={scanState === "loading"}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 8,
              background: C.goldSoft, border: `1px solid ${C.gold}`, color: C.gold,
              fontFamily: "inherit", fontSize: 14, fontWeight: 500, cursor: scanState === "loading" ? "wait" : "pointer",
            }}>
            {scanState === "loading" ? <Loader2 size={16} className="spin" /> : <FileUp size={16} />}
            {scanState === "loading" ? "Scanning bill…" : "Upload utility bill (PDF)"}
          </button>
          <div style={{ flex: 1, minWidth: 220, fontSize: 13, color: C.dim, lineHeight: 1.5, display: "flex", alignItems: "center", gap: 8 }}>
            {scanState === "done" && <CheckCircle2 size={16} color={C.green} style={{ flexShrink: 0 }} />}
            {scanState === "error" && <XCircle size={16} color={C.copper} style={{ flexShrink: 0 }} />}
            <span style={{ color: scanState === "done" ? C.green : scanState === "error" ? C.copper : C.dim }}>
              {scanMsg || "AI reads the bill and pulls utility, usage, rate — plus existing solar production and battery if they're on a NEM statement. Review what it fills in before quoting."}
            </span>
          </div>
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
                  </div>
                )}
              </Field>

              <Field label="Where are you located? (state)">
                <select value={stateSel} onChange={(e) => pickState(e.target.value)}
                  style={{ width: "100%", background: C.night, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
                  {STATES.map((st) => <option key={st} value={st}>{st}</option>)}
                </select>
              </Field>

              <Field label="Power company in your area">
                <select value={utilityId} onChange={(e) => pickUtility(e.target.value)}
                  style={{ width: "100%", background: C.night, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
                  {UTILITIES.filter((u) => u.st === stateSel || u.id === "custom").map((u) => (
                    <option key={u.id} value={u.id}>{u.name} — {u.region}</option>
                  ))}
                </select>
                <div className="mono" style={{ fontSize: 11.5, color: C.dim, marginTop: 8 }}>
                  est. ${rate.toFixed(2)}/kWh · {sunHrs} sun hrs/day{geoState === "done" ? " (measured at this address)" : " (regional default — use the address lookup for measured data)"}
                </div>
              </Field>

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
                <Field label={`Existing system size: ${existKw.toFixed(1)} kW`} hint="From the original install docs or inverter monitoring app">
                  <Slider value={existKw} min={1} max={20} step={0.5} onChange={setExistKw} />
                </Field>
                <Field label="Inverter architecture">
                  <div style={{ display: "flex", gap: 8 }}>
                    {INVERTERS.map((inv) => (
                      <Toggle key={inv.id} active={existType === inv.id} onClick={() => setExistType(inv.id)} color={C.green}>{inv.name}</Toggle>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: C.dim, marginTop: 8, lineHeight: 1.55 }}>{inverter.note}</div>
                </Field>
                <Field label={`System age: ${existAge} yrs`} hint="Panels lose ~0.5% output per year">
                  <Slider value={existAge} min={0} max={25} step={1} onChange={setExistAge} />
                </Field>
                <Field label="Known annual production (kWh)" hint="Optional — from Enphase/SolarEdge monitoring or the uploaded NEM statement. Leave 0 to estimate.">
                  <NumInput prefix="kWh" value={existProdOverride ?? 0} min={0} max={40000} step={100}
                    onChange={(v) => setExistProdOverride(v > 0 ? v : null)} />
                  <div className="mono" style={{ fontSize: 11.5, color: C.green, marginTop: 4 }}>
                    Existing production: {fmt(r.existProd)} kWh/yr ({fmt(r.existOffsetPct)}% of usage)
                  </div>
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
                      <Field label={`Existing battery capacity: ${battKwh.toFixed(1)} kWh`}
                        hint="Common sizes — Powerwall 3: 13.5 · Enphase 5P: 5.0 · FranklinWH: 15.0 · stack for more">
                        <Slider value={battKwh} min={5} max={40} step={0.5} onChange={setBattKwh} />
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          {[5, 13.5, 27, 40].map((k) => (
                            <Toggle key={k} active={battKwh === k} onClick={() => setBattKwh(k)} color={C.teal} small>{k} kWh</Toggle>
                          ))}
                        </div>
                      </Field>
                    )}
                    <div className="mono" style={{ fontSize: 11.5, color: C.teal, lineHeight: 1.8 }}>
                      Backup: ~{fmt(r.backupHours)} hrs at avg load · shifts {fmt(r.shiftable)} kWh/yr of surplus
                      <br />Self-consumption value: ~${fmt(r.battSavings)}/yr vs exporting at ${EXPORT_RATE.toFixed(2)}/kWh
                      {battMode === "new" && <><br />Adds ${fmt(r.battCost)} to system cost (before 30% ITC)</>}
                    </div>
                  </div>
                )}
              </div>

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
                  {hasExisting && `${r.existPanels} existing + `}{r.nPanels} new · {fmt(r.actualKw + (hasExisting ? existKw : 0), 1)} kW
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
                const unitCount = battMode === "new" ? battUnits : Math.ceil(battKwh / unitSize);
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
                  {hasExisting && <><br /><span style={{ color: C.green }}>▸ {r.existPanels} panels existing</span> = {existKw.toFixed(1)} kW already on the roof</>}
                  {battMode !== "none" && (battMode === "new"
                    ? <><br /><span style={{ color: C.teal }}>▸ {battUnits} × {battProd.name}</span> = {r.battKwhEff.toFixed(1)} kWh / {(battUnits * battProd.unitKw).toFixed(1)} kW output (new)</>
                    : <><br /><span style={{ color: C.teal }}>▸ {battKwh} kWh existing battery</span></>)}
                  <br /><span style={{ color: C.dim }}>▸ Covers {fmt(Math.min(r.offsetPct, 999))}% of {fmt(r.sizingUsage)} kWh/yr{r.loadsFuture > 0 ? " (incl. future loads)" : ""}</span>
                </div>
              </div>

              <div className="mono" style={{ fontSize: 12, color: C.dim, marginTop: 10 }}>New array needs ≈ {fmt(r.roofArea)} sq ft of roof</div>
            </div>
          </div>

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
                    {hasExisting && <Bar dataKey="existing" name="Existing solar" stackId="solar" fill={C.green} />}
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
              <Stat icon={<Sun size={16} color={C.green} />} label="Existing production" value={`${fmt(r.existProd)} kWh`} sub={`${existKw.toFixed(1)} kW ${inverter.name.toLowerCase()}, ${existAge} yrs old`} accent={C.green} />
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
            {hasExisting && <>• Existing: {r.existPanels} panels ({existKw.toFixed(1)} kW, {inverter.name.toLowerCase()}, {existAge} yrs) producing ~{fmt(r.existProd)} kWh/yr<br /></>}
            {battMode === "new" && <>• <b>{battUnits} × {battProd.name}</b> = {r.battKwhEff.toFixed(1)} kWh storage / {(battUnits * battProd.unitKw).toFixed(1)} kW output<br /></>}
            {battMode === "existing" && <>• Existing battery: {battKwh} kWh<br /></>}
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
                <th style={{ textAlign: "left" }}>Month</th>{hasExisting && <th>Existing</th>}<th>New solar</th><th>Usage</th><th>Offset</th>
              </tr>
            </thead>
            <tbody>
              {r.monthly.map((m) => (
                <tr key={m.month}>
                  <td style={{ textAlign: "left", padding: "1px 0" }}>{m.month}</td>
                  {hasExisting && <td>{fmt(m.existing)}</td>}
                  <td>{fmt(m.newSolar)}</td><td>{fmt(m.usage)}</td>
                  <td>{fmt(((m.existing + m.newSolar) / Math.max(m.usage, 1)) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ fontSize: 10, color: "#555", marginTop: 16, lineHeight: 1.5, borderTop: "1px solid #ccc", paddingTop: 8 }}>
            This is a preliminary estimate, not a binding quote. Production modeled from measured local irradiance, {Math.round(invProd.derate * 100)}% system output after real-world losses, and 0.5%/yr panel degradation. Costs use estimated installed pricing ($2.75/W solar; battery per selected product) and assume 30% federal ITC eligibility — consult a tax professional. Utility rates, export credits, and incentives change; final design and pricing follow a site survey and engineering review.
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ on, setOn, color, fill, icon, title, children }) {
  return (
    <div style={{ margin: "0 -24px 22px", padding: "18px 24px", background: on ? fill : "transparent", borderTop: "1px solid #22385A", borderBottom: "1px solid #22385A", transition: "background .25s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {icon}
          <span style={{ fontSize: 13.5, fontWeight: 500 }}>{title}</span>
        </div>
        <button onClick={() => setOn(!on)} aria-pressed={on}
          style={{ width: 46, height: 26, borderRadius: 13, cursor: "pointer", position: "relative", background: on ? color : "#22385A", border: "none", transition: "background .2s" }}>
          <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#EAF0F7", transition: "left .2s" }} />
        </button>
      </div>
      {on && <div style={{ marginTop: 18 }}>{children}</div>}
    </div>
  );
}

function AerialView({ la, lo, height = 220 }) {
  const z = 19;
  const n = Math.pow(2, z);
  const latR = (la * Math.PI) / 180;
  const xf = ((lo + 180) / 360) * n;
  const yf = ((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n;
  const tx = Math.floor(xf), ty = Math.floor(yf);
  // pixel position of the point inside the 3x3 (768px) tile grid
  const px = 256 + (xf - tx) * 256;
  const py = 256 + (yf - ty) * 256;
  const tiles = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      tiles.push({ dx, dy, url: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${ty + dy}/${tx + dx}` });
  return (
    <div style={{ position: "relative", width: "100%", height, overflow: "hidden", borderRadius: 10, border: "1px solid #22385A", background: "#0B1626" }}>
      <div style={{ position: "absolute", width: 768, height: 768, left: `calc(50% - ${px}px)`, top: `calc(50% - ${py}px)` }}>
        {tiles.map((t, i) => (
          <img key={i} src={t.url} alt="" width={256} height={256} draggable={false}
            style={{ position: "absolute", left: (t.dx + 1) * 256, top: (t.dy + 1) * 256, display: "block" }}
            onError={(e) => { e.currentTarget.style.display = "none"; }} />
        ))}
      </div>
      {/* pin on the house */}
      <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -100%)", pointerEvents: "none" }}>
        <svg width="26" height="34" viewBox="0 0 26 34">
          <path d="M13 0C5.8 0 0 5.8 0 13c0 9.8 13 21 13 21s13-11.2 13-21C26 5.8 20.2 0 13 0z" fill="#F5B62E" stroke="#0B1626" strokeWidth="1.5" />
          <circle cx="13" cy="13" r="5" fill="#0B1626" />
        </svg>
      </div>
      <div className="mono" style={{ position: "absolute", right: 6, bottom: 4, fontSize: 8.5, color: "#fff", textShadow: "0 0 3px #000" }}>
        Imagery © Esri World Imagery
      </div>
    </div>
  );
}

function Toggle({ active, onClick, children, color = "#F5B62E", small }) {
  return (
    <button onClick={onClick}
      style={{
        flex: small ? "none" : 1, padding: small ? "6px 12px" : "9px 0", borderRadius: 8, cursor: "pointer",
        fontSize: small ? 12.5 : 13.5, fontFamily: "inherit", fontWeight: 500,
        background: active ? `${color}22` : "transparent",
        border: `1px solid ${active ? color : "#22385A"}`,
        color: active ? color : "#8FA3BC",
      }}>
      {children}
    </button>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 4 }}>{label}</div>
      {hint ? <div style={{ fontSize: 12, color: "#8FA3BC", marginBottom: 8 }}>{hint}</div> : <div style={{ height: 4 }} />}
      {children}
    </div>
  );
}

function MiniInput({ label, value, min, max, step, onChange }) {
  const [draft, setDraft] = useState(null);
  const commit = (raw) => {
    const v = parseFloat(raw);
    if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
    setDraft(null);
  };
  return (
    <div>
      <div className="mono" style={{ fontSize: 10.5, color: "#8FA3BC", marginBottom: 3 }}>{label}</div>
      <input type="number" className="mono"
        value={draft !== null ? draft : value}
        min={min} max={max} step={step}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(e.currentTarget.value); }}
        style={{ background: "#0B1626", color: "#EAF0F7", border: "1px solid #22385A", borderRadius: 6, padding: "5px 8px", fontSize: 13, width: 78 }} />
    </div>
  );
}

function NumInput({ prefix, value, min, max, step, onChange, decimals = 0 }) {
  const [draft, setDraft] = useState(null);
  const commit = (raw) => {
    const v = parseFloat(raw);
    if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
    setDraft(null);
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
      <span className="mono" style={{ color: "#F5B62E", fontSize: 15 }}>{prefix}</span>
      <input type="number" className="mono"
        value={draft !== null ? draft : (decimals ? value.toFixed(decimals) : value)}
        min={min} max={max} step={step}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(e.currentTarget.value); }}
        style={{ background: "#0B1626", color: "#EAF0F7", border: "1px solid #22385A", borderRadius: 8, padding: "8px 12px", fontSize: 16, width: 110 }} />
    </div>
  );
}

function Slider({ value, min, max, step, onChange }) {
  return (
    <input type="range" value={value} min={min} max={max} step={step}
      onChange={(e) => onChange(parseFloat(e.target.value))} aria-label="slider" />
  );
}

function Stat({ icon, label, value, sub, accent }) {
  return (
    <div style={{ background: "#13233A", border: "1px solid #22385A", borderRadius: 14, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {icon}
        <span className="mono" style={{ fontSize: 11, letterSpacing: 1.5, color: "#8FA3BC", textTransform: "uppercase" }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent || "#EAF0F7" }}>{value}</div>
      <div style={{ fontSize: 12.5, color: "#8FA3BC", marginTop: 4 }}>{sub}</div>
    </div>
  );
}
