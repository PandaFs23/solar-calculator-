// Color palette
export const C = {
  night: "#0B1626", slate: "#13233A", cell: "#1C3554", cellLit: "#2C4E7A",
  gold: "#F5B62E", goldSoft: "#F5B62E22", copper: "#E08E45",
  green: "#5BC98C", greenSoft: "#5BC98C22", teal: "#4CC3D9", tealSoft: "#4CC3D922",
  text: "#EAF0F7", dim: "#8FA3BC", line: "#22385A",
};

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const SEASON = [0.72, 0.82, 0.98, 1.10, 1.18, 1.22, 1.24, 1.20, 1.08, 0.92, 0.76, 0.68];
export const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const USE_SEASON = [0.98, 0.92, 0.90, 0.90, 0.96, 1.05, 1.15, 1.18, 1.10, 0.98, 0.92, 0.96];
export const SCALE_TOTAL = DAYS.reduce((s, d, i) => s + d * SEASON[i], 0);

export const DERATE = 0.8;
export const COST_PER_WATT = 2.75;
export const TAX_CREDIT = 0.30;
export const PANEL_SQFT = 20;
export const RATE_ESCALATION = 0.04;
export const DEGRADATION = 0.005;
// battery economics (NEM 3.0-style: exports worth far less than retail)
export const EXPORT_RATE = 0.08;      // $/kWh for exported surplus
export const BATT_EFF = 0.90;         // round-trip efficiency
export const BATT_UTIL = 0.80;        // avg daily cycling utilization
export const SOLAR_HOUR_SHARE = 0.45; // share of home usage during solar hours
export const BATT_COST_KWH = 1000;    // installed $/kWh before ITC
export const BATT_KW_PER_KWH = 0.5;   // approx continuous inverter output per kWh of storage
export const EV_MI_PER_KWH = 3.5;     // typical EV efficiency
