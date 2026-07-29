// Buildability / feasibility checker. Pure function.
//
// Runs a checklist against a proposed design and returns a list of
// { severity, category, message, field } items. UI groups them into
// errors (block "Calculate"), warnings (allow with acknowledgment), and
// info (advisory). Deep-link `field` back to the input that surfaced it.
//
// Rules are intentionally conservative: a rule only fires when the design
// clearly violates it OR when the user has supplied the site data needed
// to check it. Rules that need spec sheet data (Voc, Isc, Vmp, Imp) the
// current product database doesn't carry are skipped silently instead of
// guessing — the honest-data rule.
import { smallestGaugeFor, nextBreakerSize } from "../data/necAmpacity.js";

// severity ranks
const SEV_RANK = { error: 3, warning: 2, info: 1 };

// Panel weight defaults if not supplied — commercial 500W+ modules run
// heavier per panel; residential 400W range is ~22 kg (~48 lb).
const DEFAULT_PANEL_LB = 48;
const DEFAULT_ROOF_PSF_CAPACITY = 20; // typical residential roof code minimum

export function checkFeasibility({
  // system as built
  nPanels, actualKw, panel, inverter,
  battKwhEff, dailyUsageKwh,
  // architecture: microinverters skip several DC-side checks
  invArch = "micro", // 'micro' | 'string' | 'threephase'
  // site-supplied (optional; rule skipped when null/undefined)
  availableRoofSqft = null,
  panelSqft = 20,
  panelWeightLb = null,
  roofPsfCapacity = null,
  interconnectKw = null,     // utility export cap
  mainBreakerAmps = null,    // service size (200A residential typical)
  serviceVoltage = 240,      // 240 residential single-phase, 208/480 3ph
}) {
  const items = [];
  const push = (severity, category, message, field) =>
    items.push({ severity, category, message, field });

  // ---- Rule: no panels selected ----
  if (!nPanels || nPanels < 1) {
    push("error", "sizing", "System has no panels — set an array size or a target kW.", "panels");
    // return early; downstream rules are meaningless without an array
    return { items, summary: summarize(items) };
  }

  // ---- Rule: roof area vs packing factor (0.75) ----
  const requiredSqft = nPanels * panelSqft;
  if (availableRoofSqft != null && availableRoofSqft > 0) {
    const usable = availableRoofSqft * 0.75;
    if (requiredSqft > usable) {
      push("error", "roof", `Array needs ~${Math.round(requiredSqft)} sq ft but only ~${Math.round(usable)} sq ft is usable (75% packing factor of ${availableRoofSqft} sq ft available). Reduce panels, use higher-wattage modules, or add roof area.`, "roofSqft");
    } else if (requiredSqft > usable * 0.9) {
      push("warning", "roof", `Array uses ~${Math.round((requiredSqft / usable) * 100)}% of usable roof — leave headroom for setbacks and fire-code pathways.`, "roofSqft");
    }
  } else {
    push("info", "roof", `Array needs ≈ ${Math.round(requiredSqft)} sq ft. Enter available roof area to verify it fits.`, "roofSqft");
  }

  // ---- Rule: structural load ----
  const perPanelLb = panelWeightLb ?? DEFAULT_PANEL_LB;
  const totalLb = perPanelLb * nPanels;
  const loadPsf = requiredSqft > 0 ? totalLb / requiredSqft : 0;
  const capPsf = roofPsfCapacity ?? DEFAULT_ROOF_PSF_CAPACITY;
  if (loadPsf > capPsf) {
    push("warning", "structural", `Array adds ~${loadPsf.toFixed(1)} psf (${Math.round(totalLb)} lb over ~${Math.round(requiredSqft)} sq ft) — exceeds assumed ${capPsf} psf capacity. A structural engineer should verify the roof before install.`, "roofPsfCapacity");
  }

  // ---- Rule: MPPT sizing (string inverters only — data not present for micros) ----
  if (invArch === "string" && inverter?.ratedW) {
    const ratio = (actualKw * 1000) / inverter.ratedW;
    if (ratio > 1.33) {
      push("error", "mppt", `Array is ${(ratio * 100).toFixed(0)}% of inverter rating — exceeds 133% MPPT limit. Add inverter capacity or reduce panels.`, "inverter");
    } else if (ratio < 0.9) {
      push("warning", "mppt", `Array is only ${(ratio * 100).toFixed(0)}% of inverter rating — inverter is oversized for the array, worse efficiency at low output.`, "inverter");
    }
  }

  // ---- Rule: AC output current, breaker, wire ----
  const acAmps = (actualKw * 1000) / (serviceVoltage || 240);
  const continuousAmps = acAmps * 1.25; // NEC continuous-load multiplier
  const requiredBreaker = nextBreakerSize(continuousAmps);
  const wire = smallestGaugeFor(continuousAmps);
  push("info", "electrical", `AC output ≈ ${acAmps.toFixed(1)} A at ${serviceVoltage} V → ${continuousAmps.toFixed(1)} A continuous → ${requiredBreaker} A breaker, min AWG ${wire.awg} Cu (75 °C).`, "inverter");

  // ---- Rule: main panel headroom (120% rule) ----
  if (mainBreakerAmps != null && mainBreakerAmps > 0) {
    const permitted = mainBreakerAmps * 1.2 - mainBreakerAmps;
    if (requiredBreaker > permitted) {
      push("error", "main-panel", `Solar backfeed breaker ${requiredBreaker} A exceeds NEC 705.12(B)(3)(2) 120% allowance (${permitted.toFixed(0)} A) on a ${mainBreakerAmps} A main. Options: line-side tap, main-panel upgrade, or supply-side connection.`, "mainBreakerAmps");
    } else if (requiredBreaker > permitted * 0.9) {
      push("warning", "main-panel", `Backfeed breaker ${requiredBreaker} A is close to the 120% limit on a ${mainBreakerAmps} A main — verify with an actual load calculation.`, "mainBreakerAmps");
    }
  }

  // ---- Rule: utility interconnect cap ----
  if (interconnectKw != null && interconnectKw > 0 && actualKw > interconnectKw) {
    push("error", "interconnect", `Proposed ${actualKw.toFixed(1)} kW exceeds utility interconnect limit of ${interconnectKw} kW — application will be rejected. Reduce array or apply for a larger interconnect study.`, "interconnectKw");
  }

  // ---- Rule: permit threshold ----
  if (actualKw > 10) {
    push("info", "permit", `Array > 10 kW often triggers additional AHJ review (structural stamp, expedited-permit ineligibility). Confirm local rules early.`, "panels");
  }

  // ---- Rule: battery sizing ----
  if (battKwhEff > 0 && dailyUsageKwh > 0) {
    const ratio = battKwhEff / dailyUsageKwh;
    if (ratio < 0.5) {
      push("warning", "battery", `Battery ${battKwhEff.toFixed(1)} kWh is only ~${(ratio * 100).toFixed(0)}% of a day's usage (${dailyUsageKwh.toFixed(1)} kWh) — short backup runtime and limited daily arbitrage.`, "battery");
    } else if (ratio > 2) {
      push("warning", "battery", `Battery ${battKwhEff.toFixed(1)} kWh is ${ratio.toFixed(1)}× daily usage — likely oversized for load-shift; check whether the extra capacity earns its cost.`, "battery");
    }
  }

  return { items, summary: summarize(items) };
}

function summarize(items) {
  return {
    errors:   items.filter((i) => i.severity === "error").length,
    warnings: items.filter((i) => i.severity === "warning").length,
    infos:    items.filter((i) => i.severity === "info").length,
    highest:  items.reduce((h, i) => (SEV_RANK[i.severity] > SEV_RANK[h] ? i.severity : h), "info"),
    canBuild: items.every((i) => i.severity !== "error"),
  };
}
