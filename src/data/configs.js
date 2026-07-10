// ---- system configuration presets ----
export const SYS_CONFIGS = [
  { id: "whole", name: "Whole-Home Backup", blurb: "Everything stays on in an outage — AC, well pump, EV, all of it. Battery bank sized to the home's full peak load.", sets: "All active loads → backup · Powerwall 3 · units auto-sized to peak kW" },
  { id: "partial", name: "Partial Backup", blurb: "A critical-loads panel keeps essentials running: fridge, lights, WiFi, medical. The most cost-effective resilience.", sets: "Essential loads → backup · 1 battery unit · critical-loads panel" },
  { id: "tou", name: "TOU / Self-Consumption", blurb: "Battery cycles daily — stores midday solar, discharges at expensive evening rates. Built for NEM 3.0 economics, not outages.", sets: "No backup loads · 1 battery unit · maximizes rate arbitrage" },
  { id: "backuponly", name: "Backup-Only (no new solar)", blurb: "Battery charges from the grid (or existing solar) purely for outage protection. Zero new panels.", sets: "New array → 0 panels · essentials backed up · battery sized to those loads" },
];
