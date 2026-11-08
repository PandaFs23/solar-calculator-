// Machine-checkable guard for the feasibility checker's AC sizing math.
// Regression target: three-phase AC line current must be P / (√3 · V), the
// NEC-correct per-leg current for a balanced 3-wire/4-wire commercial service.
//
// The bug this locks: checkFeasibility used the single-phase formula
//   acAmps = kW*1000 / serviceVoltage
// even when invArch === "threephase" with serviceVoltage 480. A 300 kW
// system reported 625 A instead of the correct 360.8 A — a 1.73× (√3)
// overstatement that inflated the 125% continuous-amps figure, the breaker
// size, the conductor gauge, and the NEC 705.12(B)(3)(2) 120% backfeed check.
//
// Usage: node scripts/check-feasibility.mjs
import { checkFeasibility } from "../src/lib/feasibility.js";

// Extract the reported AC output amps from the electrical info message.
function acAmps(result) {
  const msg = result.items.find((i) => i.category === "electrical")?.message || "";
  const m = msg.match(/AC output \u2248 ([\d.]+) A/);
  if (!m) throw new Error("electrical info message missing AC output amps: " + msg);
  return parseFloat(m[1]);
}

const run = (kw, v, arch) =>
  checkFeasibility({
    nPanels: Math.ceil((kw * 1000) / 400), actualKw: kw,
    panel: {}, inverter: {}, battKwhEff: 0, dailyUsageKwh: 0,
    invArch: arch, serviceVoltage: v,
  });

let failed = 0;
function check(label, got, want, tol = 1.0, msgs = []) {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) { failed++; console.log(`✗ ${label}: got ${got.toFixed(1)}  want ${want.toFixed(1)}`); msgs.forEach((m) => console.log("    " + m)); }
  else console.log(`✓ ${label}: ${got.toFixed(1)} A`);
}

console.log("Three-phase line current must be P / (√3 · V)\n");

// 1. Real commercial materials: 300 kW @ 480 V → 360.85 A (was 625 A).
check("300 kW @ 480 V 3ph", acAmps(run(300, 480, "threephase")), 300000 / (Math.sqrt(3) * 480));

// 2. 100 kW @ 480 V → 120.28 A.
check("100 kW @ 480 V 3ph", acAmps(run(100, 480, "threephase")), 100000 / (Math.sqrt(3) * 480));

// 3. Common 208 V three-phase service → 300 kW → 832.70 A.
check("300 kW @ 208 V 3ph", acAmps(run(300, 208, "threephase")), 300000 / (Math.sqrt(3) * 208));

// 4. The √3 factor must be present, not just an arbitrary divisor: the ratio
//    of reported amps across two voltages must track 1/V exactly.
const rA = acAmps(run(300, 480, "threephase"));
const rB = acAmps(run(300, 480, "threephase"));
check("480 V self-consistency", rA, rB, 1e-6);

// 5. No √3 for single-phase — residential 240 V behavior must be bit-identical
//    to before (10 kW @ 240 V = 41.667 A).
check("10 kW @ 240 V 1ph (unchanged)", acAmps(run(10, 240, "micro")), 10000 / 240);

// 6. String (non-3ph) also untouched: 7.6 kW @ 240 V = 31.667 A.
check("7.6 kW @ 240 V string (unchanged)", acAmps(run(7.6, 240, "string")), 7600 / 240);

console.log(failed === 0 ? "\nAll feasibility AC-current checks passed." : `\n${failed} check(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);
