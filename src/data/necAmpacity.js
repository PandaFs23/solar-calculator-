// NEC 310.16 ampacity for common wire gauges, 60/75/90 °C insulation ratings.
// Copper only (the material 99% of residential PV runs use). Values in amps.
// This is a bundled lookup, not a legal reference — for permit-drawing loads
// verify against a current NEC edition and local amendments. Included so the
// Advanced-tab feasibility checker can flag obvious wire-gauge mismatches
// without asking the user to know the code by heart.
export const NEC_AMPACITY_CU = [
  { awg: "14", a60: 15,  a75: 20,  a90: 25  },
  { awg: "12", a60: 20,  a75: 25,  a90: 30  },
  { awg: "10", a60: 30,  a75: 35,  a90: 40  },
  { awg: "8",  a60: 40,  a75: 50,  a90: 55  },
  { awg: "6",  a60: 55,  a75: 65,  a90: 75  },
  { awg: "4",  a60: 70,  a75: 85,  a90: 95  },
  { awg: "3",  a60: 85,  a75: 100, a90: 115 },
  { awg: "2",  a60: 95,  a75: 115, a90: 130 },
  { awg: "1",  a60: 110, a75: 130, a90: 145 },
  { awg: "1/0",a60: 125, a75: 150, a90: 170 },
  { awg: "2/0",a60: 145, a75: 175, a90: 195 },
  { awg: "3/0",a60: 165, a75: 200, a90: 225 },
  { awg: "4/0",a60: 195, a75: 230, a90: 260 },
];

// Given a continuous current in amps, return the smallest copper gauge whose
// 75 °C ampacity carries it (75 °C is the default terminal rating for most
// residential equipment; safer than 90 °C which is derated at terminations).
export function smallestGaugeFor(amps) {
  return NEC_AMPACITY_CU.find((w) => w.a75 >= amps) || NEC_AMPACITY_CU[NEC_AMPACITY_CU.length - 1];
}

// Standard breaker sizes typically stocked (residential + light commercial).
export const STANDARD_BREAKERS = [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200];

// Round UP to the next standard breaker size (NEC 240.6 rounding).
export function nextBreakerSize(amps) {
  return STANDARD_BREAKERS.find((b) => b >= amps) || STANDARD_BREAKERS[STANDARD_BREAKERS.length - 1];
}
