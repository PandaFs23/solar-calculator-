// Normalization for the tracked existing-systems array (Phase 7).
//
// ONE source of truth, used by BOTH the editor panel's aggregate readout and
// the sizing model. Before this existed the panel hardcoded a 0.8 derate while
// solarMath used DERATE with a per-system override, so the "combined output"
// a rep read could disagree with the offset the proposal was built on.
//
// SIZE, NOT DRIFT: a system's capacity has exactly one basis, chosen per entry:
//   sizeBasis "panels" → kW is derived from panelCount × panelWatts
//   sizeBasis "kw"     → panelCount is derived from kW ÷ panelWatts
// The derived value is always displayed read-only. The two never both accept
// input, so they cannot disagree.
//
// DERATE: a recorded inverter model contributes its own system derate (already
// device efficiency × 0.88 — see data/products.js). With no model recorded we
// fall back to the generic DERATE constant. Irradiance is applied separately by
// solarMath and is never folded in here.
import { DERATE } from "../data/constants.js";

// Hard cap on existing systems the model tracks, INCLUDING the primary
// "Home has existing solar" card — that card is entry 1, and this array holds
// entries 2..MAX_SYSTEMS.
export const MAX_SYSTEMS = 5;
export const DEFAULT_PANEL_WATTS = 350; // typical of the 2010s installs these usually are

// A fresh row must contribute ZERO production until a rep actually fills it in
// — otherwise adding a row would silently move the offset and the proposal.
// panelWatts is prefilled because it is a multiplier, not a quantity: a
// non-zero default there changes nothing while panelCount/ratedKw are 0.
export function emptySystem() {
  return {
    id: (globalThis.crypto?.randomUUID?.()) || `sys_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    sizeBasis: "panels",
    panelCount: 0,
    panelWatts: DEFAULT_PANEL_WATTS,
    ratedKw: 0,
    installedYear: new Date().getFullYear() - 3,
    invProdId: "",     // "" = generic; otherwise an ALL_INVERTER_PRODUCTS id
    measuredKwh: 0,    // 0 = estimate from capacity
  };
}

// Tolerates records written before sizeBasis/panelWatts/invProdId existed.
export function normalizeSystem(raw) {
  const panelWatts = Number(raw?.panelWatts) > 0 ? Number(raw.panelWatts) : DEFAULT_PANEL_WATTS;
  const storedKw = Number(raw?.ratedKw) || 0;
  const storedCount = Number(raw?.panelCount) || 0;
  // Legacy rows carried both fields independently. Prefer whichever was
  // actually filled in, favouring panel count when both are present.
  const sizeBasis = raw?.sizeBasis === "kw" || raw?.sizeBasis === "panels"
    ? raw.sizeBasis
    : (storedCount > 0 ? "panels" : "kw");
  return {
    ...emptySystem(),
    ...raw,
    panelWatts,
    sizeBasis,
    panelCount: storedCount,
    ratedKw: storedKw,
  };
}

// The derived pair. Exactly one of these is user-entered; the other is computed.
export function systemRatedKw(sys) {
  const s = normalizeSystem(sys);
  if (s.sizeBasis === "panels") return (Number(s.panelCount) || 0) * (Number(s.panelWatts) || 0) / 1000;
  return Number(s.ratedKw) || 0;
}

export function systemPanelCount(sys) {
  const s = normalizeSystem(sys);
  if (s.sizeBasis === "panels") return Math.max(0, Math.round(Number(s.panelCount) || 0));
  const w = Number(s.panelWatts) || 0;
  return w > 0 ? Math.round(((Number(s.ratedKw) || 0) * 1000) / w) : 0;
}

export function systemAge(sys, now = new Date().getFullYear()) {
  const yr = Number(sys?.installedYear) || 0;
  if (!yr) return 0;
  return Math.max(0, Math.min(60, now - yr));
}

// Derate for this system: the recorded inverter's, else the generic constant.
// Already includes device efficiency × 0.88 — never multiply efficiency again.
export function systemDerate(sys, inverterProducts = []) {
  const prod = sys?.invProdId ? inverterProducts.find((p) => p.id === sys.invProdId) : null;
  return prod?.derate ?? DERATE;
}

// Map the UI array into the shape computeResidential() consumes. Systems with
// no capacity AND no measured output contribute nothing and are dropped, so an
// untouched blank first row can never shift the numbers.
export function toModelSystems(systems, inverterProducts = []) {
  return (systems || [])
    .map((sys) => ({
      ratedKw: systemRatedKw(sys),
      panelCount: systemPanelCount(sys),
      age: systemAge(sys),
      inverterDerate: systemDerate(sys, inverterProducts),
      measuredKwh: Number(sys?.measuredKwh) || 0,
    }))
    .filter((s) => s.ratedKw > 0 || s.measuredKwh > 0);
}

// Aggregate annual production, using the SAME arithmetic as solarMath so the
// panel's readout always matches the proposal.
//   prod = measured, or ratedKw × Σ(PSH×DAYS) × derate × degradation^age
export function aggregateProduction(systems, inverterProducts, pshDaysYr, degradation) {
  return toModelSystems(systems, inverterProducts).reduce((total, s) => {
    if (s.measuredKwh > 0) return total + s.measuredKwh;
    const eff = s.inverterDerate * Math.pow(1 - degradation, s.age);
    return total + s.ratedKw * pshDaysYr * eff;
  }, 0);
}

export function aggregateRatedKw(systems) {
  return (systems || []).reduce((s, x) => s + systemRatedKw(x), 0);
}
