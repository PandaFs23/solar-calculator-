import { useState, useMemo, useRef } from "react";
import { Building2, Zap, DollarSign, Percent, TrendingUp, BatteryCharging, Loader2, MapPin, Gauge, Printer } from "lucide-react";
import {
  ComposedChart, Bar, Line, Area, AreaChart, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, ReferenceLine,
} from "recharts";

import { C, RATE_ESCALATION, EXPORT_RATE } from "../data/constants.js";
import { STATES, UTILITIES, getSchedules } from "../data/utilities.js";
import { COMMERCIAL_PANEL_PRODUCTS, COMMERCIAL_INVERTER_PRODUCTS, COMMERCIAL_COST_TIERS } from "../data/commercialProducts.js";
import { BATTERY_PRODUCTS } from "../data/products.js";
import { computeCommercial, tierCostPerWatt } from "../lib/commercialMath.js";
import { fetchAddressSuggestions, geocodeAddress, fetchPeakSunHours, guessUtility, fetchPropertyType } from "../lib/geo.js";
import ModeSuggestionBanner from "../components/ModeSuggestionBanner.jsx";
import AerialView from "../components/AerialView.jsx";
import Toggle from "../components/Toggle.jsx";
import Field from "../components/Field.jsx";
import NumInput from "../components/NumInput.jsx";
import Slider from "../components/Slider.jsx";
import Stat from "../components/Stat.jsx";

export default function CommercialCalculator({ onSwitchMode, onLocated, suppressedAddresses, suppressAddress }) {
  const [stateSel, setStateSel] = useState("CA");
  const [utilityId, setUtilityId] = useState("sdge");
  const [scheduleId, setScheduleId] = useState("gs_demand");

  // usage & billing — commercial bills have TWO components (3a)
  const [inputMode, setInputMode] = useState("kwh"); // 'kwh' | 'bill'
  const [annualKwh, setAnnualKwh] = useState(120000);
  const [monthlyBill, setMonthlyBill] = useState(3500);
  const [energyRate, setEnergyRate] = useState(0.29);   // sdge gs_demand est.
  const [peakKw, setPeakKw] = useState(40);             // demand line on the bill
  const [demandRate, setDemandRate] = useState(16);     // $/kW/month
  const [sunHrs, setSunHrs] = useState(5.5);

  // sizing & economics (3d)
  const [selfCons, setSelfCons] = useState(0.75);       // daytime-coincident load
  const [panels, setPanels] = useState(null);
  const [panelProdId, setPanelProdId] = useState(COMMERCIAL_PANEL_PRODUCTS[0].id);
  const [invProdId, setInvProdId] = useState(COMMERCIAL_INVERTER_PRODUCTS[0].id);
  const [cpwOverride, setCpwOverride] = useState(null); // null = auto tier
  const [macrsOn, setMacrsOn] = useState(false);
  const [taxRate, setTaxRate] = useState(0.26);

  // battery — demand-charge shaving, not backup
  const [battMode, setBattMode] = useState("none");     // 'none' | 'new'
  const [battProdId, setBattProdId] = useState("pw3");
  const [battUnits, setBattUnits] = useState(2);
  const [shaveDepth, setShaveDepth] = useState(0.25);

  // report + chart
  const [businessName, setBusinessName] = useState("");
  const [chartView, setChartView] = useState("monthly");

  // address lookup (shared with residential via lib/geo.js)
  const [address, setAddress] = useState("");
  const [geoState, setGeoState] = useState("idle");
  const [geoMsg, setGeoMsg] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [sitePos, setSitePos] = useState(null);
  const [propType, setPropType] = useState(null); // OSM building-tag hint for the located address
  const sugTimer = useRef(null);

  const utility = UTILITIES.find((u) => u.id === utilityId);
  const schedules = getSchedules(utility, true);
  const schedule = schedules.find((s) => s.id === scheduleId) || schedules[0];
  const panelProd = COMMERCIAL_PANEL_PRODUCTS.find((p) => p.id === panelProdId);
  const invProd = COMMERCIAL_INVERTER_PRODUCTS.find((p) => p.id === invProdId);
  const battProd = BATTERY_PRODUCTS.find((p) => p.id === battProdId);
  const panelW = panelProd.watts;

  const pickUtility = (id) => {
    const u = UTILITIES.find((x) => x.id === id);
    setUtilityId(id);
    setStateSel(u.st);
    const sched = getSchedules(u, true)[1]; // General Service Demand (TOU)
    setScheduleId(sched.id);
    setEnergyRate(sched.rate ?? u.rate * 0.75);
    setDemandRate(sched.demandRate ?? 16);
    setSunHrs(u.sunHrs);
  };

  const pickUtilityKeepSun = (id, psh) => {
    const u = UTILITIES.find((x) => x.id === id);
    setUtilityId(id);
    setStateSel(u.st);
    const sched = getSchedules(u, true)[1];
    setScheduleId(sched.id);
    setEnergyRate(sched.rate ?? u.rate * 0.75);
    setDemandRate(sched.demandRate ?? 16);
    setSunHrs(Math.round(Math.min(7, Math.max(3, psh)) * 10) / 10);
  };

  const pickSchedule = (sid) => {
    setScheduleId(sid);
    const sched = schedules.find((x) => x.id === sid);
    if (sched && sched.rate != null) setEnergyRate(sched.rate);
    if (sched && sched.demandRate != null) setDemandRate(sched.demandRate);
  };

  // editing either rate directly flips the schedule to Custom
  const setEnergyRateCustom = (v) => { setEnergyRate(v); setScheduleId("customrate"); };
  const setDemandRateCustom = (v) => { setDemandRate(v); setScheduleId("customrate"); };

  const pickState = (st) => {
    setStateSel(st);
    const first = UTILITIES.find((u) => u.st === st);
    if (first && utility.st !== st) pickUtility(first.id);
  };

  const onAddressChange = (v) => {
    setAddress(v);
    if (sugTimer.current) clearTimeout(sugTimer.current);
    if (v.trim().length < 4) { setSuggestions([]); return; }
    sugTimer.current = setTimeout(async () => {
      try {
        setSuggestions(await fetchAddressSuggestions(v));
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
    // property-type hint runs in parallel and never blocks the solar data
    setPropType(null);
    onLocated?.(shortName);
    fetchPropertyType(la, lo)
      .then((pt) => setPropType({ ...pt, addr: shortName }))
      .catch((err) => console.warn("Property type lookup failed:", err));
    try {
      const { psh, yr } = await fetchPeakSunHours(la, lo);
      setSunHrs(Math.round(psh * 10) / 10);
      let guessed = "";
      const g = guessUtility(la, lo, stateName);
      if (g) { pickUtilityKeepSun(g.id, psh); guessed = ` · looks like ${g.label} territory`; }
      setGeoState("done");
      setGeoMsg(`${shortName} — measured ${psh.toFixed(1)} peak sun hrs/day (${yr} data)${guessed}`);
    } catch (err) {
      console.warn("Solar data fetch failed:", err);
      setGeoState("error");
      setGeoMsg("Found the address but couldn't pull its solar data — set sun hours manually.");
    }
  };

  const r = useMemo(() => computeCommercial({
    inputMode, annualKwh, monthlyBill,
    energyRate, peakKw, demandRate,
    sunHrs, panels, panelW, invProd,
    selfConsumption: selfCons,
    costPerWattOverride: cpwOverride,
    macrsOn, taxRate,
    battMode, battUnits, battProd,
    shaveDepth,
  }), [inputMode, annualKwh, monthlyBill, energyRate, peakKw, demandRate, sunHrs, panels, panelW, invProd, selfCons, cpwOverride, macrsOn, taxRate, battMode, battUnits, battProd, shaveDepth]);

  const fmt = (n, d = 0) =>
    n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });

  const shownNew = Math.min(r.nPanels, 60);
  const overflow = r.nPanels - shownNew;
  const offsetColor = r.offsetPct >= 95 ? C.green : r.offsetPct >= 60 ? C.gold : C.copper;
  const hasBatt = battMode === "new";

  return (
    <>
      <div className="app-screen" style={{ maxWidth: 1040, margin: "0 auto", padding: "0 20px 64px" }}>
        <h1 style={{ fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 700, margin: "4px 0 8px", lineHeight: 1.15 }}>
          Commercial solar &amp; storage
        </h1>
        <p style={{ color: C.dim, maxWidth: 680, margin: "0 0 20px", fontSize: 15, lineHeight: 1.6 }}>
          Commercial bills have two parts — energy (per kWh) and demand (per kW). Solar offsets the energy line;
          batteries clip the monthly peaks that drive the demand line. All rates and costs below are estimates — verify against the actual tariff.
        </p>

        {/* save report bar */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
          <input type="text" value={businessName} placeholder="Business name (for the report)"
            onChange={(e) => setBusinessName(e.target.value)}
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

        <div style={{ display: "grid", gap: 24 }}>
          <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>

            {/* ---- inputs ---- */}
            <div style={{ background: C.slate, border: `1px solid ${C.line}`, borderRadius: 14, padding: 24 }}>
              <Field label="Business address" hint="Type to see address suggestions — picking one pulls a year of measured solar data for the exact site">
                <div style={{ position: "relative" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="text" value={address} placeholder="500 Commerce Way, San Diego, CA"
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
                    <div className="mono" style={{ fontSize: 10.5, color: C.dim, marginTop: 4 }}>Roof view of the located property — check usable roof area, HVAC units, and shading</div>
                    {propType?.propertyType === "residential" && !suppressedAddresses?.has(propType.addr) && (
                      <ModeSuggestionBanner osmLabel={propType.osmLabel} targetMode="residential"
                        onSwitch={() => { suppressAddress?.(propType.addr); onSwitchMode?.("residential"); }}
                        onDismiss={() => suppressAddress?.(propType.addr)} />
                    )}
                  </div>
                )}
              </Field>

              <Field label="State">
                <select value={stateSel} onChange={(e) => pickState(e.target.value)}
                  style={{ width: "100%", background: C.night, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
                  {STATES.map((st) => <option key={st} value={st}>{st}</option>)}
                </select>
              </Field>

              <Field label="Utility">
                <select value={utilityId} onChange={(e) => pickUtility(e.target.value)}
                  style={{ width: "100%", background: C.night, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
                  {UTILITIES.filter((u) => u.st === stateSel || u.id === "custom").map((u) => (
                    <option key={u.id} value={u.id}>{u.name} — {u.region}</option>
                  ))}
                </select>
                <div className="mono" style={{ fontSize: 11.5, color: C.dim, marginTop: 8 }}>
                  {sunHrs} sun hrs/day{geoState === "done" ? " (measured at this address)" : " (regional default — use the address lookup for measured data)"}
                </div>
              </Field>

              <Field label="Rate schedule" hint={schedule.note || "Pick the plan from the bill — or set custom rates below"}>
                <select value={scheduleId} onChange={(e) => pickSchedule(e.target.value)}
                  style={{ width: "100%", background: C.night, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
                  {schedules.map((sch) => (
                    <option key={sch.id} value={sch.id}>{sch.name}{sch.rate != null ? ` — ~$${sch.rate.toFixed(2)}/kWh + $${sch.demandRate}/kW·mo` : ""}</option>
                  ))}
                </select>
                <div className="mono" style={{ fontSize: 11, color: C.dim, marginTop: 8, lineHeight: 1.7 }}>
                  Commercial tariff lookup:{" "}
                  <a href="https://apps.openei.org/USURDB/" target="_blank" rel="noopener noreferrer" style={{ color: C.gold, textDecoration: "underline" }}>OpenEI rate database</a>
                  {" · "}
                  <a href={`https://www.google.com/search?q=${encodeURIComponent(utility.name.split(" (")[0] + " commercial general service rate schedule tariff demand charge")}`} target="_blank" rel="noopener noreferrer" style={{ color: C.gold, textDecoration: "underline" }}>search current tariffs</a>
                  {utility.link && (
                    <>
                      {" · "}
                      <a href={utility.link} target="_blank" rel="noopener noreferrer" style={{ color: C.gold, textDecoration: "underline" }}>{utility.name.split(" (")[0]} site</a>
                    </>
                  )}
                </div>
              </Field>

              <Field label="How do you want to enter usage?">
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <Toggle active={inputMode === "kwh"} onClick={() => setInputMode("kwh")}>Annual kWh</Toggle>
                  <Toggle active={inputMode === "bill"} onClick={() => setInputMode("bill")}>Monthly bill $</Toggle>
                </div>
                {inputMode === "kwh" ? (
                  <>
                    <div style={{ fontSize: 13, color: C.dim, marginBottom: 8 }}>Annual energy from the bills (kWh) — the most accurate way to size</div>
                    <NumInput prefix="kWh" value={annualKwh} min={5000} max={5000000} step={1000} onChange={setAnnualKwh} />
                    <Slider value={annualKwh} min={20000} max={1000000} step={5000} onChange={setAnnualKwh} />
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 13, color: C.dim, marginBottom: 8 }}>Total monthly bill including the demand line — energy usage is backed out from the rates below</div>
                    <NumInput prefix="$" value={monthlyBill} min={100} max={100000} step={100} onChange={setMonthlyBill} />
                    <Slider value={monthlyBill} min={500} max={25000} step={100} onChange={setMonthlyBill} />
                  </>
                )}
              </Field>

              <Field label={`Peak demand: ${fmt(peakKw)} kW`} hint="From the bill's demand line (kW, sometimes 'maximum demand') — drives the demand charge">
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <Slider value={peakKw} min={5} max={500} step={5} onChange={setPeakKw} />
                  </div>
                  <NumInput prefix="kW" value={peakKw} min={1} max={5000} step={5} onChange={setPeakKw} />
                </div>
              </Field>

              <Field label={`Demand charge: $${demandRate.toFixed(2)}/kW per month${scheduleId === "customrate" ? " (custom)" : ""}`}
                hint="Typical range $10–25/kW/mo — editing switches the schedule to Custom">
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <Slider value={demandRate} min={0} max={40} step={0.5} onChange={setDemandRateCustom} />
                  </div>
                  <NumInput prefix="$" value={demandRate} min={0} max={100} step={0.5} onChange={setDemandRateCustom} decimals={2} />
                </div>
              </Field>

              <Field label={`Energy rate: $${energyRate.toFixed(2)}/kWh${scheduleId === "customrate" ? " (custom)" : ""}`}
                hint="Editable any time — adjusting it switches the schedule to Custom">
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <Slider value={energyRate} min={0.05} max={0.50} step={0.01} onChange={setEnergyRateCustom} />
                  </div>
                  <NumInput prefix="$" value={energyRate} min={0.02} max={2} step={0.01} onChange={setEnergyRateCustom} decimals={2} />
                </div>
              </Field>

              {/* blended-rate decomposition — demand charges are where batteries earn their keep */}
              <div style={{ margin: "0 -24px 22px", padding: "16px 24px", background: C.night, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Gauge size={15} color={C.gold} />
                  <span className="mono" style={{ fontSize: 11.5, letterSpacing: 2, color: C.dim }}>ANNUAL BILL DECOMPOSITION</span>
                </div>
                <div className="mono" style={{ fontSize: 12.5, lineHeight: 2 }}>
                  <span style={{ color: C.gold }}>Energy: {fmt(r.usageKwh)} kWh × ${energyRate.toFixed(2)} = ${fmt(r.annualEnergyCost)}/yr</span>
                  <br /><span style={{ color: C.teal }}>Demand: {fmt(peakKw)} kW × ${demandRate.toFixed(2)} × 12 = ${fmt(r.annualDemandCost)}/yr ({fmt(r.demandShare * 100)}% of the bill)</span>
                  <br /><span style={{ color: C.text }}>Total ${fmt(r.annualBill)}/yr → blended ${r.blendedRate.toFixed(3)}/kWh</span>
                </div>
                <div style={{ height: 10, borderRadius: 5, background: C.slate, border: `1px solid ${C.line}`, overflow: "hidden", display: "flex", marginTop: 8 }}>
                  <div style={{ width: `${(1 - r.demandShare) * 100}%`, background: `linear-gradient(90deg, ${C.copper}, ${C.gold})` }} />
                  <div style={{ width: `${r.demandShare * 100}%`, background: C.teal }} />
                </div>
                <div className="mono" style={{ fontSize: 10.5, color: C.dim, marginTop: 4 }}>
                  <span style={{ color: C.gold }}>■</span> energy &nbsp; <span style={{ color: C.teal }}>■</span> demand
                </div>
              </div>

              <Field label={`Solar self-consumption: ${Math.round(selfCons * 100)}%`}
                hint="Share of solar output used on-site. Commercial load is daytime-coincident, so 70–85% is typical (vs ~35% residential). Surplus exports at the low export rate.">
                <Slider value={selfCons} min={0.5} max={0.95} step={0.05} onChange={setSelfCons} />
              </Field>

              <Field label={`New array: ${r.nPanels} panels`}
                hint={panels === null ? "Auto-sized to cover 100% of annual usage — drag to explore" : `Auto size: ${r.autoPanels} panels`}>
                <Slider value={r.nPanels} min={0} max={Math.max(120, r.autoPanels + 30)} step={1} onChange={(v) => setPanels(v)} />
                {panels !== null && (
                  <button onClick={() => setPanels(null)}
                    style={{ marginTop: 8, background: "transparent", border: `1px solid ${C.line}`, color: C.dim, borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                    Reset to auto size
                  </button>
                )}
              </Field>

              <Field label="Panel product (large-format commercial)" hint={panelProd.note}>
                <select value={panelProdId} onChange={(e) => setPanelProdId(e.target.value)}
                  style={{ width: "100%", background: C.night, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
                  {[...new Set(COMMERCIAL_PANEL_PRODUCTS.map((p) => p.mfr))].map((m) => (
                    <optgroup key={m} label={m}>
                      {COMMERCIAL_PANEL_PRODUCTS.filter((p) => p.mfr === m).map((p) => (
                        <option key={p.id} value={p.id}>{p.name} — {p.watts} W · {p.eff}%</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>

              <Field label="Inverter system (three-phase)" hint={invProd.note}>
                <select value={invProdId} onChange={(e) => setInvProdId(e.target.value)}
                  style={{ width: "100%", background: C.night, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
                  {COMMERCIAL_INVERTER_PRODUCTS.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — {p.deviceEff}% device / {Math.round(p.derate * 1000) / 10}% system</option>
                  ))}
                </select>
              </Field>

              <Field label={`Installed cost: $${r.costPerWatt.toFixed(2)}/W${cpwOverride !== null ? " (custom)" : " (auto by size tier)"}`}
                hint={COMMERCIAL_COST_TIERS.map((t) => t.label).join(" · ")}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <Slider value={r.costPerWatt} min={1.0} max={3.5} step={0.05} onChange={(v) => setCpwOverride(v)} />
                  </div>
                  <NumInput prefix="$" value={r.costPerWatt} min={0.5} max={6} step={0.05} onChange={(v) => setCpwOverride(v)} decimals={2} />
                </div>
                {cpwOverride !== null && (
                  <button onClick={() => setCpwOverride(null)}
                    style={{ marginTop: 8, background: "transparent", border: `1px solid ${C.line}`, color: C.dim, borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                    Reset to auto tier (${tierCostPerWatt(r.actualKw).toFixed(2)}/W)
                  </button>
                )}
              </Field>

              {/* MACRS */}
              <div style={{ margin: "0 -24px 22px", padding: "18px 24px", background: macrsOn ? C.greenSoft : "transparent", borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`, transition: "background .25s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <DollarSign size={16} color={macrsOn ? C.green : C.dim} />
                    <span style={{ fontSize: 13.5, fontWeight: 500 }}>MACRS 5-yr depreciation (estimate — not tax advice)</span>
                  </div>
                  <button onClick={() => setMacrsOn(!macrsOn)} aria-pressed={macrsOn}
                    style={{ width: 46, height: 26, borderRadius: 13, cursor: "pointer", position: "relative", background: macrsOn ? C.green : "#22385A", border: "none", transition: "background .2s" }}>
                    <span style={{ position: "absolute", top: 3, left: macrsOn ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#EAF0F7", transition: "left .2s" }} />
                  </button>
                </div>
                {macrsOn && (
                  <div style={{ marginTop: 14 }}>
                    <Field label={`Combined tax rate: ${Math.round(taxRate * 100)}%`} hint="Federal + state marginal rate applied to the depreciable basis (basis = cost − ½ × ITC)">
                      <Slider value={taxRate} min={0.10} max={0.45} step={0.01} onChange={setTaxRate} />
                    </Field>
                    <div className="mono" style={{ fontSize: 11.5, color: C.green, lineHeight: 1.8 }}>
                      Basis ${fmt(r.macrsBasis)} × {Math.round(taxRate * 100)}% ≈ ${fmt(r.macrsBenefit)} tax benefit
                      <br />Effective after-tax cost: ${fmt(r.effectiveCost)} — confirm with the business's tax professional
                    </div>
                  </div>
                )}
              </div>

              {/* battery — demand shaving */}
              <div style={{ margin: "0 -24px 0", padding: "18px 24px 0", background: hasBatt ? C.tealSoft : "transparent", transition: "background .25s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <BatteryCharging size={16} color={hasBatt ? C.teal : C.dim} />
                  <span style={{ fontSize: 13.5, fontWeight: 500 }}>Battery — demand-charge shaving</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Toggle active={battMode === "none"} onClick={() => setBattMode("none")} color={C.teal}>None</Toggle>
                  <Toggle active={battMode === "new"} onClick={() => setBattMode("new")} color={C.teal}>Add battery</Toggle>
                </div>
                {hasBatt && (
                  <div style={{ marginTop: 16 }}>
                    <Field label="Battery product" hint={battProd.note}>
                      <select value={battProdId} onChange={(e) => setBattProdId(e.target.value)}
                        style={{ width: "100%", background: C.night, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
                        {BATTERY_PRODUCTS.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} — {p.unitKwh} kWh / {p.unitKw} kW (~${p.price.toLocaleString()}/unit)</option>
                        ))}
                      </select>
                    </Field>
                    <Field label={`Units: ${battUnits} × ${battProd.unitKwh} kWh = ${r.battKwhEff.toFixed(1)} kWh · ${r.battKw.toFixed(1)} kW output`}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        {[1, 2, 4, 6, 8].map((n) => (
                          <Toggle key={n} active={battUnits === n} onClick={() => setBattUnits(n)} color={C.teal} small>{n} unit{n > 1 ? "s" : ""}</Toggle>
                        ))}
                      </div>
                    </Field>
                    <Field label={`Peak shave target: ${Math.round(shaveDepth * 100)}% of peak`}
                      hint="How much of the monthly peak the battery tries to clip. Deeper shaves need more energy capacity — sizing here assumes a ~3-hour peak window; real 15-minute interval data is needed to guarantee a level.">
                      <Slider value={shaveDepth} min={0.1} max={0.5} step={0.05} onChange={setShaveDepth} />
                    </Field>
                    <div className="mono" style={{ fontSize: 11.5, color: C.teal, lineHeight: 1.8, paddingBottom: 18 }}>
                      Clips ~{r.clippedKw.toFixed(1)} kW off the {fmt(peakKw)} kW peak → billed demand ~{r.newPeakKw.toFixed(1)} kW
                      <br />Demand savings: ~${fmt(r.demandSavings)}/yr at ${demandRate.toFixed(2)}/kW·mo
                      <br />Adds ${fmt(r.battCost)} to system cost (ITC-eligible)
                    </div>
                  </div>
                )}
                {!hasBatt && <div style={{ paddingBottom: 18 }} />}
              </div>
            </div>

            {/* ---- system + demand panel ---- */}
            <div style={{ background: C.slate, border: `1px solid ${C.line}`, borderRadius: 14, padding: 24, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span className="mono" style={{ fontSize: 12, letterSpacing: 2, color: C.dim }}>PROPOSED SYSTEM</span>
                <span className="mono" style={{ fontSize: 13, color: C.gold }}>
                  {r.nPanels} × {panelW} W · {fmt(r.actualKw, 1)} kW
                </span>
              </div>

              <div style={{ margin: "10px 0 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: C.dim }}>Energy offset</span>
                  <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: offsetColor }}>{fmt(Math.min(r.offsetPct, 999))}%</span>
                </div>
                <div style={{ height: 10, borderRadius: 5, background: C.night, border: `1px solid ${C.line}`, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(r.offsetPct, 100)}%`, height: "100%", background: `linear-gradient(90deg, ${C.copper}, ${C.gold})`, transition: "width .3s ease" }} />
                </div>
                <div className="mono" style={{ fontSize: 11.5, color: C.dim, marginTop: 5 }}>
                  {fmt(r.selfUsedKwh)} kWh self-consumed at ${energyRate.toFixed(2)} · {fmt(r.exportedKwh)} kWh exported at ${EXPORT_RATE.toFixed(2)}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 4, flex: 1, alignContent: "start" }}>
                {Array.from({ length: shownNew }).map((_, i) => (
                  <div key={`n-${shownNew}-${i}`} className="cell" title="Panel"
                    style={{ aspectRatio: "1 / 1.4", borderRadius: 3, background: `linear-gradient(160deg, ${C.cellLit}, ${C.cell})`, border: `1px solid ${C.line}`, animationDelay: `${i * 8}ms` }} />
                ))}
              </div>
              {overflow > 0 && <div className="mono" style={{ fontSize: 12, color: C.dim, marginTop: 6 }}>+ {overflow} more panels</div>}

              {/* demand analysis */}
              <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 10, background: hasBatt ? C.tealSoft : C.night, border: `1px solid ${hasBatt ? C.teal + "55" : C.line}` }}>
                <div className="mono" style={{ fontSize: 11, letterSpacing: 1.5, color: hasBatt ? C.teal : C.dim, marginBottom: 8 }}>DEMAND ANALYSIS</div>
                <div className="mono" style={{ fontSize: 12.5, lineHeight: 1.9 }}>
                  <span style={{ color: C.text }}>▸ Billed peak today: {fmt(peakKw)} kW → ${fmt(r.annualDemandCost)}/yr in demand charges</span>
                  {hasBatt ? (
                    <>
                      <br /><span style={{ color: C.teal }}>▸ Battery clips ~{r.clippedKw.toFixed(1)} kW → new billed peak ~{r.newPeakKw.toFixed(1)} kW</span>
                      <br /><span style={{ color: C.teal }}>▸ Demand savings ~${fmt(r.demandSavings)}/yr</span>
                    </>
                  ) : (
                    <><br /><span style={{ color: C.dim }}>▸ Add a battery to clip monthly peaks — at ${demandRate.toFixed(0)}/kW·mo every clipped kW saves ${fmt(demandRate * 12)}/yr</span></>
                  )}
                </div>
              </div>

              {/* exact equipment list */}
              <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 8, background: C.night, border: `1px solid ${C.line}` }}>
                <div className="mono" style={{ fontSize: 11, letterSpacing: 1.5, color: C.dim, marginBottom: 6 }}>EXACT EQUIPMENT FOR THIS FACILITY</div>
                <div className="mono" style={{ fontSize: 12.5, lineHeight: 1.9 }}>
                  <span style={{ color: C.gold }}>▸ {r.nPanels} × {panelProd.mfr} {panelProd.name} ({panelW} W)</span> = {fmt(r.actualKw, 1)} kW solar
                  {r.nPanels > 0 && <><br /><span style={{ color: C.gold }}>▸ {invProd.name}</span></>}
                  {hasBatt && <><br /><span style={{ color: C.teal }}>▸ {battUnits} × {battProd.name}</span> = {r.battKwhEff.toFixed(1)} kWh / {r.battKw.toFixed(1)} kW</>}
                  <br /><span style={{ color: C.dim }}>▸ Offsets {fmt(Math.min(r.offsetPct, 999))}% of {fmt(r.usageKwh)} kWh/yr · needs ≈ {fmt(r.roofArea)} sq ft of roof</span>
                </div>
              </div>
            </div>
          </div>

          {/* ---- charts ---- */}
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
                    <YAxis tick={{ fill: C.dim, fontSize: 12 }} axisLine={false} tickLine={false} unit=" kWh" width={80} />
                    <Tooltip contentStyle={{ background: C.night, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13 }} labelStyle={{ color: C.text }}
                      formatter={(v, name) => [`${v.toLocaleString()} kWh`, name]} />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    <Bar dataKey="solar" name="Solar production" fill={C.gold} radius={[3, 3, 0, 0]} />
                    <Line dataKey="usage" name="Facility usage" stroke={C.copper} strokeWidth={2.5} dot={{ r: 3, fill: C.copper }} />
                  </ComposedChart>
                ) : (
                  <AreaChart data={r.savings} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="comSavedGrad" x1="0" y1="0" x2="0" y2="1">
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
                    <Area dataKey="saved" name="Cumulative savings (energy + demand)" stroke={C.green} strokeWidth={2.5} fill="url(#comSavedGrad)" />
                    <ReferenceLine y={r.effectiveCost} stroke={C.gold} strokeDasharray="6 4"
                      label={{ value: `System cost $${fmt(r.effectiveCost)}`, fill: C.gold, fontSize: 12, position: "insideTopRight" }} />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
            <p className="mono" style={{ fontSize: 11.5, color: C.dim, margin: "12px 0 0" }}>
              {chartView === "monthly"
                ? "Commercial usage runs flatter across the year than residential; solar output still peaks in summer."
                : `Rates rise ${RATE_ESCALATION * 100}%/yr, panels degrade 0.5%/yr. Break-even ~${fmt(r.payback, 1)} yrs${macrsOn ? " (after-tax cost incl. MACRS estimate)" : ""}.`}
            </p>
          </div>

          {/* ---- results ---- */}
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <Stat icon={<Percent size={16} color={offsetColor} />} label="Energy offset" value={`${fmt(Math.min(r.offsetPct, 999))}%`}
              sub={`of ${fmt(r.usageKwh)} kWh/yr`} accent={offsetColor} />
            <Stat icon={<Zap size={16} color={C.gold} />} label="System size" value={`${fmt(r.actualKw, 1)} kW`} sub={`${r.nPanels} × ${panelW} W panels`} />
            <Stat icon={<Building2 size={16} color={C.gold} />} label="Blended rate" value={`$${r.blendedRate.toFixed(3)}`}
              sub={`${fmt(r.demandShare * 100)}% of bill is demand charges`} />
            {hasBatt && (
              <Stat icon={<BatteryCharging size={16} color={C.teal} />} label="Demand savings" value={`$${fmt(r.demandSavings)}/yr`}
                sub={`clips ~${r.clippedKw.toFixed(1)} kW off the peak`} accent={C.teal} />
            )}
            <Stat icon={<DollarSign size={16} color={C.gold} />} label={macrsOn ? "Cost after ITC + MACRS (est.)" : "Cost after 30% ITC"} value={`$${fmt(r.effectiveCost)}`}
              sub={`$${fmt(r.grossCost)} gross at $${r.costPerWatt.toFixed(2)}/W${hasBatt ? " incl. battery" : ""}`} />
            <Stat icon={<TrendingUp size={16} color={C.green} />} label="Payback" value={r.payback > 0 ? `${fmt(r.payback, 1)} yrs` : "—"}
              sub={`saves ~$${fmt(r.annualSavings)}/yr (energy + demand)`} accent={C.green} />
            <Stat icon={<TrendingUp size={16} color={C.green} />} label="25-year savings" value={`$${fmt(r.savings25)}`} sub="with rate escalation" accent={C.green} />
          </div>

          <p style={{ color: C.dim, fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
            All numbers are estimates for a first conversation, not a quote. Commercial rate schedules and demand charges vary widely — pull the actual tariff (links above) and 12 months of bills with the demand line. Panel and inverter specs marked "placeholder — confirm" await the owner's product database; installed $/W uses size-tier estimates, not distributor pricing. MACRS depreciation is an estimate and not tax advice — model it with the business's CPA. Demand-shave results assume a ~3-hour peak window; guaranteeing a shave level requires 15-minute interval data.
          </p>
        </div>
      </div>

      {/* ---- commercial PDF report (print only) ---- */}
      <div className="print-report">
        <div style={{ borderBottom: "3px solid #F5B62E", paddingBottom: 10, marginBottom: 18 }}>
          <div className="mono" style={{ fontSize: 11, letterSpacing: 3, color: "#946A0E" }}>COMMERCIAL SOLAR + STORAGE ESTIMATE</div>
          <div style={{ fontSize: 26, fontWeight: 700, margin: "4px 0" }}>System Proposal</div>
          <div style={{ fontSize: 12.5, color: "#444" }}>
            Prepared for: <b>{businessName || "________________"}</b> &nbsp;·&nbsp; {address || "Address on file"} &nbsp;·&nbsp; {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>

        {sitePos && (
          <div style={{ marginBottom: 14 }}>
            <AerialView la={sitePos.la} lo={sitePos.lo} height={190} />
          </div>
        )}

        <div style={{ fontSize: 13, lineHeight: 1.7 }}>
          <div style={{ fontWeight: 700, fontSize: 14, borderBottom: "1px solid #ccc", marginBottom: 6 }}>Site &amp; Billing</div>
          <div>
            Utility: <b>{utility.name}</b>{schedule.id !== "customrate" ? ` — ${schedule.name}` : " — custom rates"} · Solar resource: <b>{sunHrs} peak sun hrs/day</b><br />
            Energy: <b>{fmt(r.usageKwh)} kWh/yr</b> at ~${energyRate.toFixed(2)}/kWh = ${fmt(r.annualEnergyCost)}/yr<br />
            Demand: <b>{fmt(peakKw)} kW peak</b> at ${demandRate.toFixed(2)}/kW·mo = ${fmt(r.annualDemandCost)}/yr ({fmt(r.demandShare * 100)}% of the bill)<br />
            Total ${fmt(r.annualBill)}/yr → blended rate ${r.blendedRate.toFixed(3)}/kWh
          </div>

          <div style={{ fontWeight: 700, fontSize: 14, borderBottom: "1px solid #ccc", margin: "14px 0 6px" }}>Recommended System</div>
          <div>
            {r.nPanels > 0 && <>• <b>{r.nPanels} × {panelProd.mfr} {panelProd.name}</b> ({panelW} W, {panelProd.eff}% efficiency) = <b>{fmt(r.actualKw, 1)} kW</b><br /></>}
            {r.nPanels > 0 && <>• <b>{invProd.name}</b> — {invProd.deviceEff}% device efficiency<br /></>}
            {hasBatt && <>• <b>{battUnits} × {battProd.name}</b> = {r.battKwhEff.toFixed(1)} kWh storage / {r.battKw.toFixed(1)} kW output<br /></>}
            • Energy offset: <b>{fmt(Math.min(r.offsetPct, 999))}%</b> ({Math.round(selfCons * 100)}% self-consumed on-site) · Roof area: ~{fmt(r.roofArea)} sq ft
          </div>

          <div style={{ fontWeight: 700, fontSize: 14, borderBottom: "1px solid #ccc", margin: "14px 0 6px" }}>Demand Analysis</div>
          <div>
            Billed peak demand today: <b>{fmt(peakKw)} kW</b> → ${fmt(r.annualDemandCost)}/yr in demand charges<br />
            {hasBatt ? (
              <>
                Battery clips <b>~{r.clippedKw.toFixed(1)} kW</b> (target {Math.round(shaveDepth * 100)}% of peak, ~3-hr window) → new billed peak <b>~{r.newPeakKw.toFixed(1)} kW</b><br />
                Estimated demand savings: <b>${fmt(r.demandSavings)}/yr</b> — verify with 15-minute interval data before guaranteeing a shave level
              </>
            ) : (
              <>No battery in this proposal — each kW clipped from the peak would save ${fmt(demandRate * 12)}/yr at the current demand charge.</>
            )}
          </div>

          <div style={{ fontWeight: 700, fontSize: 14, borderBottom: "1px solid #ccc", margin: "14px 0 6px" }}>Investment &amp; Savings</div>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
            <tbody>
              <tr><td style={{ padding: "3px 0" }}>System cost (before incentives, ${r.costPerWatt.toFixed(2)}/W est.)</td><td style={{ textAlign: "right" }}><b>${fmt(r.grossCost)}</b></td></tr>
              <tr><td style={{ padding: "3px 0" }}>Federal tax credit (30% ITC)</td><td style={{ textAlign: "right" }}>−${fmt(r.itc)}</td></tr>
              {macrsOn && <tr><td style={{ padding: "3px 0" }}>MACRS 5-yr depreciation benefit (estimate, not tax advice)</td><td style={{ textAlign: "right" }}>−${fmt(r.macrsBenefit)}</td></tr>}
              <tr style={{ borderTop: "1px solid #ccc" }}><td style={{ padding: "3px 0" }}><b>{macrsOn ? "Effective after-tax cost (est.)" : "Net investment"}</b></td><td style={{ textAlign: "right" }}><b>${fmt(r.effectiveCost)}</b></td></tr>
              <tr><td style={{ padding: "3px 0" }}>First-year savings (energy + demand)</td><td style={{ textAlign: "right" }}>${fmt(r.annualSavings)}/yr</td></tr>
              <tr><td style={{ padding: "3px 0" }}>Estimated payback</td><td style={{ textAlign: "right" }}>{r.payback > 0 ? `${fmt(r.payback, 1)} years` : "—"}</td></tr>
              <tr><td style={{ padding: "3px 0" }}>25-year savings (4%/yr rate escalation)</td><td style={{ textAlign: "right" }}><b>${fmt(r.savings25)}</b></td></tr>
            </tbody>
          </table>

          <div style={{ fontWeight: 700, fontSize: 14, borderBottom: "1px solid #ccc", margin: "14px 0 6px" }}>Estimated Monthly Production (kWh)</div>
          <table className="mono" style={{ borderCollapse: "collapse", width: "100%", fontSize: 10.5, textAlign: "right" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #999" }}>
                <th style={{ textAlign: "left" }}>Month</th><th>Solar</th><th>Usage</th><th>Offset</th>
              </tr>
            </thead>
            <tbody>
              {r.monthly.map((m) => (
                <tr key={m.month}>
                  <td style={{ textAlign: "left", padding: "1px 0" }}>{m.month}</td>
                  <td>{fmt(m.solar)}</td><td>{fmt(m.usage)}</td>
                  <td>{fmt((m.solar / Math.max(m.usage, 1)) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ fontSize: 10, color: "#555", marginTop: 16, lineHeight: 1.5, borderTop: "1px solid #ccc", paddingTop: 8 }}>
            This is a preliminary estimate, not a binding quote or tax advice. Production modeled from measured local irradiance and {Math.round(invProd.derate * 100)}% system output after real-world losses, with 0.5%/yr panel degradation. Rates and demand charges are generic estimates — verify against the utility's current commercial tariff. Installed cost uses size-tier $/W estimates, not distributor pricing. MACRS treatment must be confirmed by a tax professional. Demand-shave modeling assumes a ~3-hour peak window; final battery sizing requires 15-minute interval data. Final design and pricing follow a site survey and engineering review.
          </div>
        </div>
      </div>
    </>
  );
}
