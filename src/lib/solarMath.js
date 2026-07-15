// Residential sizing + economics model, extracted verbatim from the
// calculator's useMemo. Pure function: same inputs → same outputs.
// NOTE: system derate (invProd.derate / inverter.derate) already includes
// device efficiency × environmental losses — never multiply device
// efficiency in again.
import { MONTHS, SEASON, DAYS, USE_SEASON, SCALE_TOTAL, COST_PER_WATT, TAX_CREDIT, PANEL_SQFT, RATE_ESCALATION, DEGRADATION, EXPORT_RATE, BATT_EFF, BATT_UTIL, SOLAR_HOUR_SHARE, BATT_KW_PER_KWH, EV_MI_PER_KWH } from "../data/constants.js";
import { APPLIANCES } from "../data/appliances.js";

export function computeResidential({
  rate, inputMode, annualKwh, bill,
  loads, loadVals, evMiles,
  hasExisting, existKw, existAge, existProdOverride, inverter, existPanelW,
  sunHrs, panels, panelW, invProd, sizingBasis, targetKw,
  battMode, battUnits, battProd, battKwh,
}) {
  const getWatts = (a) => loadVals[a.id]?.watts ?? a.watts;
  const getKwhYr = (a) => (a.ev ? evMiles / EV_MI_PER_KWH : (loadVals[a.id]?.kwhYr ?? a.kwhYr));

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
  // count existing panels off the recorded existing module when known, else the new panel wattage
  const existPanels = hasExisting ? Math.round((existKw * 1000) / (existPanelW || panelW)) : 0;

  // new system covers the remainder (incl. future loads)
  const remainingKwh = Math.max(sizingUsage - existProd, 0);
  // kWh produced per installed kW per year — the conversion at the heart of both sizing bases
  const kwhPerKwYr = sunHrs * invProd.derate * 365;
  // ENERGY basis: size the array to the kW that covers the remaining usage
  const autoKw = kwhPerKwYr > 0 ? remainingKwh / kwhPerKwYr : 0;
  const autoPanels = Math.ceil((autoKw * 1000) / panelW);
  // POWER basis: user targets a system wattage directly; snap to whole panels
  const powerPanels = Math.max(Math.round(((targetKw || 0) * 1000) / panelW), 0);
  const powerKw = (powerPanels * panelW) / 1000;
  // the active array follows the chosen basis, unless the user manually overrides the panel count
  const basisPanels = sizingBasis === "power" ? powerPanels : autoPanels;
  const nPanels = panels ?? basisPanels;
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

  // both sizing bases, computed side by side so the UI can show the difference & energy flow
  const prodOf = (kw) => kw * kwhPerKwYr;
  const offsetOf = (kw) => (sizingUsage > 0 ? ((existProd + prodOf(kw)) / sizingUsage) * 100 : 0);
  const sizeEnergy = { kw: autoKw, panels: autoPanels, prod: prodOf(autoKw), offsetPct: offsetOf(autoKw) };
  const sizePower = { kw: powerKw, panels: powerPanels, prod: prodOf(powerKw), offsetPct: offsetOf(powerKw) };

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
    sizingBasis, kwhPerKwYr, sizeEnergy, sizePower,
    existProd, existOffsetPct, existPanels, newProd, newOffsetPct, offsetPct,
    battSavings, backupHours, battCost, shiftable, battKwhEff,
    backupLoads, backupWatts, backupDailyKwh, invKw, backupOk, backupHrsCritical,
    grossCost, netCost, annualSavings, payback, roofArea, monthly, savings, savings25: cum,
  };
}
