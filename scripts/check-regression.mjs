// Machine-checkable guard for the CLAUDE.md "verified regression scenario".
// Runs the pure residential model with the app's own default state and asserts
// the documented outputs. Any refactor of lib/solarMath.js must keep this green
// — it is the single fastest way to prove the Basic-tab math didn't move.
//
// Usage: npm run check-regression
//
// The scenario (from CLAUDE.md):
//   Annual kWh mode, 8,400 kWh/yr, SDG&E TOU-DR1 defaults,
//   Q.Cells Q.HOME NEXT L-G3 435 W, Enphase IQ8M
//   → 13 panels, 5.7 kW, $15,551 gross / $10,886 net,
//     3.1-yr payback, $143,338 25-yr, 106% offset
//
// Quirk preserved on purpose: rate/sunHrs seed from UTILITIES[0] (PG&E
// $0.42/5.0 hrs) even though SDG&E is preselected.
import { computeResidential } from "../src/lib/solarMath.js";
import { UTILITIES, INVERTERS } from "../src/data/utilities.js";
import { ALL_PANEL_PRODUCTS, INVERTER_PRODUCTS, BATTERY_PRODUCTS, ALL_INVERTER_PRODUCTS } from "../src/data/products.js";
import { toModelSystems, aggregateProduction, emptySystem } from "../src/lib/existingSystems.js";

// Head-Dev: allow non-interactive CI invocation via --ci flag
if (process.argv.includes('--ci')) {
  // Running in CI/head-dev runner; skip TTY requirement.
} else {
  if (typeof process.stdin.isTTY !== 'undefined' && !process.stdin.isTTY) {
    console.error('stdin is not a tty');
    process.exit(1);
  }
}


const panelProd = ALL_PANEL_PRODUCTS.find((p) => p.id === "q_cells_q_home_next_l_g3_420_435_w");
const invProd   = INVERTER_PRODUCTS.find((p) => p.id === "enphase_iq8m");
const battProd  = BATTERY_PRODUCTS.find((p) => p.id === "pw3");
const inverter  = INVERTERS.find((i) => i.id === "micro");

if (!panelProd || !invProd || !battProd || !inverter) {
  console.error("✗ regression fixture missing a product id — check src/data/products.js");
  process.exit(1);
}

// Exactly the module's initial state for the documented scenario.
const baseline = {
  rate: UTILITIES[0].rate,      // 0.42 — the preserved seed quirk
  sunHrs: UTILITIES[0].sunHrs,  // 5.0  — ditto
  inputMode: "kwh",
  annualKwh: 8400,
  bill: 280,
  loads: {}, loadVals: {}, evMiles: 12000,
  hasExisting: false, existKw: 4.0, existAge: 5, existProdOverride: null,
  inverter, existPanelW: panelProd.watts,
  panels: null, panelW: panelProd.watts, invProd,
  sizingBasis: "energy", targetKw: 6,
  battMode: "none", battUnits: 1, battProd, battKwh: 13.5,
};

const EXPECT = [
  ["panels",      (r) => r.nPanels,                     13,      0],
  ["system kW",   (r) => r.actualKw,                    5.7,     0.05],
  ["gross cost",  (r) => r.grossCost,                   15551,   1],
  ["net cost",    (r) => r.netCost,                     10886,   1],
  ["payback yrs", (r) => r.payback,                     3.1,     0.05],
  ["25-yr saved", (r) => r.savings25,                   143338,  1],
  ["offset %",    (r) => r.offsetPct,                   106,     0.5],
];

let failed = 0;

function check(label, got, want, tol) {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) failed++;
  const shown = Number.isInteger(want) && tol >= 1 ? Math.round(got) : got.toFixed(2);
  console.log(`${ok ? "✓" : "✗"} ${label.padEnd(12)} got ${String(shown).padStart(8)}  want ${want}${tol ? ` ±${tol}` : ""}`);
}

console.log("CLAUDE.md verified regression — Basic tab, no advanced overrides\n");
const r = computeResidential(baseline);
EXPECT.forEach(([label, get, want, tol]) => check(label, get(r), want, tol));

// --- Invariant: passing the advanced hooks as no-ops must not move anything ---
console.log("\nNo-op advanced inputs must be byte-identical to the baseline\n");
const noop = computeResidential({
  ...baseline,
  monthlyUsageKwh: null, monthlyIrradiance: null,
  shadeFactor: null, additionalSystems: null, overrides: undefined,
});
const drift = EXPECT.filter(([, get]) => get(noop) !== get(r));
if (drift.length) {
  failed += drift.length;
  drift.forEach(([label, get]) => console.log(`✗ ${label} drifted: ${get(r)} → ${get(noop)}`));
} else {
  console.log("✓ all outputs identical with explicit-null advanced inputs");
}

// --- Invariant: derate is never squared. A 1 kW array at 1 PSH for 365 days
// must produce exactly 365 × derate kWh — no second efficiency term. ---
console.log("\nDerate must be applied exactly once (no device-efficiency double count)\n");
const unit = computeResidential({
  ...baseline, inputMode: "kwh", annualKwh: 100000, // large usage so nothing clamps
  sunHrs: 1, panels: Math.round(1000 / panelProd.watts) || 1,
});
const expectedPerKw = 1 * invProd.derate * 365;
const gotPerKw = unit.newProd / unit.actualKw;
const onceOk = Math.abs(gotPerKw - expectedPerKw) < 0.5;
if (!onceOk) failed++;
console.log(`${onceOk ? "✓" : "✗"} kWh per kW at 1 PSH: got ${gotPerKw.toFixed(2)}  want ${expectedPerKw.toFixed(2)} (derate ${invProd.derate})`);
if (!onceOk) {
  const squared = 1 * invProd.derate * invProd.derate * 365;
  console.log(`   (derate² would give ${squared.toFixed(2)} — if that matches, an efficiency term is applied twice)`);
}

// --- Invariant: NASA irradiance replaces PSH, NOT derate ---
// Each month must equal kW_DC × PSH[m] × DAYS[m] × derate, and the annual
// total must equal kW_DC × Σ(PSH[m] × DAYS[m]) × derate. If irradiance were
// folded into derate (or vice versa) these would miss by a factor of derate.
console.log("\nNASA irradiance drives PSH only — derate still applied exactly once\n");
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
// San Diego climatology, verified against the live POWER endpoint.
const PSH = [3.2498, 4.0759, 5.1638, 6.1406, 6.1313, 5.8783, 6.1385, 6.0857, 5.3544, 4.3154, 3.4421, 2.9246];

const withIrr = computeResidential({
  ...baseline, annualKwh: 100000, panels: 13, monthlyIrradiance: PSH,
});
const pshDays = PSH.reduce((s, v, i) => s + v * DAYS[i], 0);

const wantAnnual = withIrr.actualKw * pshDays * invProd.derate;
const annualOk = Math.abs(withIrr.newProd - wantAnnual) < 1;
if (!annualOk) failed++;
console.log(`${annualOk ? "✓" : "✗"} annual  got ${withIrr.newProd.toFixed(1)}  want ${wantAnnual.toFixed(1)} (kW × Σ(PSH×DAYS) × derate)`);
if (!annualOk) {
  console.log(`   derate² would give ${(withIrr.actualKw * pshDays * invProd.derate ** 2).toFixed(1)}`);
  console.log(`   derate-free would give ${(withIrr.actualKw * pshDays).toFixed(1)}`);
}

const monthMisses = withIrr.monthly.filter((m, i) => {
  const want = withIrr.actualKw * PSH[i] * DAYS[i] * invProd.derate;
  return Math.abs(m.newSolar - want) > 1.5; // Math.round in the model
});
if (monthMisses.length) failed++;
console.log(`${monthMisses.length === 0 ? "✓" : "✗"} all 12 months match kW × PSH[m] × DAYS[m] × derate${monthMisses.length ? ` (${monthMisses.length} off)` : ""}`);

// Irradiance must actually change the answer — a no-op would mean the basis
// never reached the production term.
const noIrr = computeResidential({ ...baseline, annualKwh: 100000, panels: 13 });
const moved = Math.abs(withIrr.newProd - noIrr.newProd) > 1;
if (!moved) failed++;
console.log(`${moved ? "✓" : "✗"} irradiance changes annual production (${noIrr.newProd.toFixed(0)} → ${withIrr.newProd.toFixed(0)} kWh at ${withIrr.effectiveSunHrs.toFixed(2)} vs ${noIrr.effectiveSunHrs.toFixed(2)} PSH)`);
console.log(`  basis reported: "${noIrr.irradianceBasis}" → "${withIrr.irradianceBasis}"`);

// A partial/zero-filled series must be REJECTED, not silently treated as a
// dark month — that would understate production.
const partial = computeResidential({
  ...baseline, annualKwh: 100000, panels: 13,
  monthlyIrradiance: PSH.map((v, i) => (i < 6 ? v : 0)),
});
const rejected = partial.irradianceBasis === "regional" && Math.abs(partial.newProd - noIrr.newProd) < 1;
if (!rejected) failed++;
console.log(`${rejected ? "✓" : "✗"} incomplete monthly series falls back to regional instead of modelling dark months`);

// --- Phase 7: tracked existing systems ---
// A blank row must contribute exactly nothing (otherwise adding a row silently
// moves the proposal), and multiple systems must sum into one existProd number
// that the downstream offset math consumes without caring how many there were.
console.log("\nTracked existing systems: blank rows inert, real rows sum\n");
const blankRows = computeResidential({
  ...baseline,
  additionalSystems: toModelSystems([emptySystem(), emptySystem()], ALL_INVERTER_PRODUCTS),
});
const inert = EXPECT.every(([, get]) => get(blankRows) === get(r));
if (!inert) failed++;
console.log(`${inert ? "✓" : "✗"} two blank tracked rows leave every output unchanged`);

const twoReal = [
  { ...emptySystem(), sizeBasis: "panels", panelCount: 10, panelWatts: 300, installedYear: new Date().getFullYear() },
  { ...emptySystem(), sizeBasis: "kw",     ratedKw: 5,     panelWatts: 250, installedYear: new Date().getFullYear() },
];
const mapped = toModelSystems(twoReal, ALL_INVERTER_PRODUCTS);
const kwOk = Math.abs(mapped[0].ratedKw - 3.0) < 1e-9 && Math.abs(mapped[1].ratedKw - 5) < 1e-9;
if (!kwOk) failed++;
console.log(`${kwOk ? "✓" : "✗"} panels basis 10×300W → ${mapped[0].ratedKw} kW · kW basis → ${mapped[1].ratedKw} kW`);

const countOk = mapped[0].panelCount === 10 && mapped[1].panelCount === 20;
if (!countOk) failed++;
console.log(`${countOk ? "✓" : "✗"} derived panel counts: ${mapped[0].panelCount} (entered) · ${mapped[1].panelCount} (5 kW ÷ 250 W)`);

const summed = computeResidential({ ...baseline, annualKwh: 100000, additionalSystems: mapped });
const wantSum = mapped.reduce((t, s) => t + s.ratedKw * summed.pshDaysYr * s.inverterDerate, 0);
const sumOk = Math.abs(summed.existProd - wantSum) < 1;
if (!sumOk) failed++;
console.log(`${sumOk ? "✓" : "✗"} summed existProd got ${summed.existProd.toFixed(0)}  want ${wantSum.toFixed(0)} kWh/yr`);

// The panel's displayed aggregate must equal what the model actually used —
// these were computed by two different code paths before existingSystems.js.
const shown = aggregateProduction(twoReal, ALL_INVERTER_PRODUCTS, summed.pshDaysYr, 0.005);
const agreeOk = Math.abs(shown - summed.existProd) < 1;
if (!agreeOk) failed++;
console.log(`${agreeOk ? "✓" : "✗"} panel readout (${shown.toFixed(0)}) matches the model (${summed.existProd.toFixed(0)})`);

// A recorded inverter model must actually change the derate.
const withInv = toModelSystems(
  [{ ...twoReal[0], invProdId: "enphase_iq8m" }], ALL_INVERTER_PRODUCTS
);
const derateOk = withInv[0].inverterDerate === invProd.derate && mapped[0].inverterDerate !== invProd.derate;
if (!derateOk) failed++;
console.log(`${derateOk ? "✓" : "✗"} recorded inverter sets derate: generic ${mapped[0].inverterDerate} → IQ8M ${withInv[0].inverterDerate}`);

// --- Household load quantities ---
// A count of 1 (or absent) must behave exactly as before, and N units must
// scale both annual energy and the outage draw linearly.
console.log("\nHousehold load quantity scales energy and backup draw\n");
const loadsBase = { fridge: { status: "now", backup: true } };
const one = computeResidential({ ...baseline, inputMode: "loads", loads: loadsBase });
const implicit = computeResidential({
  ...baseline, inputMode: "loads",
  loads: { fridge: { status: "now", backup: true, qty: 1 } },
});
const three = computeResidential({
  ...baseline, inputMode: "loads",
  loads: { fridge: { status: "now", backup: true, qty: 3 } },
});

const absentIsOne = one.loadsNow === implicit.loadsNow && one.backupWatts === implicit.backupWatts;
if (!absentIsOne) failed++;
console.log(`${absentIsOne ? "✓" : "✗"} absent qty behaves as 1 (${one.loadsNow} kWh, ${one.backupWatts} W)`);

const energyScales = Math.abs(three.loadsNow - one.loadsNow * 3) < 0.001;
if (!energyScales) failed++;
console.log(`${energyScales ? "✓" : "✗"} annual energy ×3: ${one.loadsNow} → ${three.loadsNow} kWh`);

const wattsScale = three.backupWatts === one.backupWatts * 3;
if (!wattsScale) failed++;
console.log(`${wattsScale ? "✓" : "✗"} backup draw ×3: ${one.backupWatts} → ${three.backupWatts} W`);

// The per-unit spec must survive — the UI's Watts input binds to it, so if the
// model folded qty into the unit value the field would multiply on every edit.
const unitIntact = three.backupLoads[0].unitWatts === one.backupLoads[0].unitWatts
  && three.backupLoads[0].qty === 3;
if (!unitIntact) failed++;
console.log(`${unitIntact ? "✓" : "✗"} per-unit spec preserved alongside the total (${three.backupLoads[0].unitWatts} W each × ${three.backupLoads[0].qty})`);

// A junk qty must not poison the model.
const junk = computeResidential({
  ...baseline, inputMode: "loads",
  loads: { fridge: { status: "now", backup: true, qty: 0 } },
});
const junkSafe = junk.loadsNow === one.loadsNow;
if (!junkSafe) failed++;
console.log(`${junkSafe ? "✓" : "✗"} qty 0 clamps to 1 rather than zeroing the load`);

console.log(failed === 0 ? "\nAll regression checks passed." : `\n${failed} check(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);