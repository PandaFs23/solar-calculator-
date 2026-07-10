// Commercial sizing + economics model. Pure function: same inputs → same outputs.
//
// Structural differences vs residential (see computeResidential):
// - Bills have TWO components: energy ($/kWh) and demand ($/kW/month).
// - Load is daytime-coincident, so solar self-consumption is high (70–85%
//   editable) instead of ~35%.
// - Batteries earn their keep by clipping monthly demand peaks, not backup.
// - Incentives: 30% ITC plus optional MACRS 5-yr depreciation (estimate only).
//
// Derate rule (same as residential): system derate = device efficiency × 0.88
// environmental losses — invProd.derate already includes both. Never multiply
// device efficiency in again.
import { MONTHS, SEASON, DAYS, SCALE_TOTAL, TAX_CREDIT, RATE_ESCALATION, DEGRADATION, EXPORT_RATE, PANEL_SQFT } from "../data/constants.js";
import { COMMERCIAL_COST_TIERS } from "../data/commercialProducts.js";

// commercial usage is flatter across the year than residential (process loads,
// HVAC in occupied buildings) — mild summer bump only
const COM_USE_SEASON = [0.97, 0.95, 0.95, 0.96, 1.00, 1.05, 1.09, 1.09, 1.04, 0.98, 0.95, 0.97];

export function tierCostPerWatt(kw) {
  return COMMERCIAL_COST_TIERS.find((t) => kw < t.maxKw)?.costPerWatt ?? COMMERCIAL_COST_TIERS[COMMERCIAL_COST_TIERS.length - 1].costPerWatt;
}

export function computeCommercial({
  inputMode, annualKwh, monthlyBill,   // 'kwh' | 'bill'
  energyRate, peakKw, demandRate,      // $/kWh, kW, $/kW/month
  sunHrs, panels, panelW, invProd,     // sizing
  selfConsumption,                     // 0.70–0.85 editable
  costPerWattOverride,                 // null = auto tier
  macrsOn, taxRate,                    // MACRS 5-yr toggle + combined tax rate (estimate)
  battMode, battUnits, battProd,       // demand-charge shaving
  shaveDepth,                          // fraction of peak the battery targets (est.)
}) {
  const safeEnergyRate = Math.max(energyRate, 0.01);

  // ---- usage & billing decomposition ----
  const annualDemandCost = peakKw * demandRate * 12;
  let usageKwh;
  if (inputMode === "kwh") {
    usageKwh = annualKwh;
  } else {
    // monthly bill includes the demand line — back the energy portion out
    const energyMo = Math.max(monthlyBill - peakKw * demandRate, monthlyBill * 0.2);
    usageKwh = (energyMo / safeEnergyRate) * 12;
  }
  usageKwh = Math.max(usageKwh, 1000);
  const annualEnergyCost = usageKwh * safeEnergyRate;
  const annualBill = annualEnergyCost + annualDemandCost;
  const blendedRate = annualBill / usageKwh;
  const demandShare = annualDemandCost / annualBill;

  // ---- solar sizing (same production physics as residential) ----
  const autoKw = (usageKwh / 365) / (sunHrs * invProd.derate);
  const autoPanels = Math.ceil((autoKw * 1000) / panelW);
  const nPanels = panels ?? autoPanels;
  const actualKw = (nPanels * panelW) / 1000;
  const production = actualKw * sunHrs * invProd.derate * 365;
  const offsetPct = (production / usageKwh) * 100;
  const roofArea = nPanels * PANEL_SQFT;

  // ---- solar energy savings: self-consumed at retail, surplus exported ----
  const selfUsedKwh = Math.min(production * selfConsumption, usageKwh);
  const exportedKwh = Math.max(production - selfUsedKwh, 0);
  const solarSavings = selfUsedKwh * safeEnergyRate + exportedKwh * EXPORT_RATE;

  // ---- battery: demand-charge shaving (headline), not backup ----
  const hasBatt = battMode === "new";
  const battKwhEff = hasBatt ? battUnits * battProd.unitKwh : 0;
  const battKw = hasBatt ? battUnits * battProd.unitKw : 0;
  // clip is limited by (a) inverter kW, (b) energy to sustain a ~3-hour peak
  // window, (c) the targeted shave depth — an estimate, real 15-min interval
  // data is needed to guarantee a shave level
  const sustainableKw = battKwhEff / 3;
  const clippedKw = hasBatt ? Math.min(battKw, sustainableKw, peakKw * shaveDepth) : 0;
  const demandSavings = clippedKw * demandRate * 12;
  const battCost = hasBatt ? battUnits * battProd.price : 0;
  const newPeakKw = peakKw - clippedKw;

  // ---- costs & incentives ----
  const costPerWatt = costPerWattOverride ?? tierCostPerWatt(actualKw);
  const grossCost = actualKw * 1000 * costPerWatt + battCost;
  const itc = grossCost * TAX_CREDIT;
  // MACRS 5-yr: depreciable basis = cost − ½·ITC; benefit ≈ basis × tax rate.
  // Simplified to a single present-value-ish number — an ESTIMATE, not tax advice.
  const macrsBasis = grossCost * (1 - TAX_CREDIT / 2);
  const macrsBenefit = macrsOn ? macrsBasis * taxRate : 0;
  const netCost = grossCost - itc;
  const effectiveCost = netCost - macrsBenefit;

  const annualSavings = solarSavings + demandSavings;
  const payback = annualSavings > 0 && effectiveCost > 0 ? effectiveCost / annualSavings : 0;

  // ---- monthly + 25-year projections ----
  const monthly = MONTHS.map((m, i) => {
    const scale = (DAYS[i] * SEASON[i]) / SCALE_TOTAL;
    return {
      month: m,
      solar: Math.round(production * scale),
      usage: Math.round((usageKwh / 12) * COM_USE_SEASON[i]),
    };
  });

  let cum = 0;
  const savings = [];
  for (let y = 0; y <= 25; y++) {
    if (y > 0) {
      const esc = Math.pow(1 + RATE_ESCALATION, y - 1);
      const deg = Math.pow(1 - DEGRADATION, y - 1);
      cum += solarSavings * deg * esc + demandSavings * esc;
    }
    savings.push({ year: y, saved: Math.round(cum), cost: Math.round(effectiveCost) });
  }

  return {
    usageKwh, annualEnergyCost, annualDemandCost, annualBill, blendedRate, demandShare,
    autoPanels, nPanels, actualKw, production, offsetPct, roofArea,
    selfUsedKwh, exportedKwh, solarSavings,
    battKwhEff, battKw, clippedKw, newPeakKw, demandSavings, battCost,
    costPerWatt, grossCost, itc, macrsBasis, macrsBenefit, netCost, effectiveCost,
    annualSavings, payback, monthly, savings, savings25: cum,
  };
}
