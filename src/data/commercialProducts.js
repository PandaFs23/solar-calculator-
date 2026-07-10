// ---- COMMERCIAL PRODUCT CATALOG ----
// The owner's spreadsheet (solar_products_complete_2000_2026_v17e.xlsx) contains
// large-format commercial panels (>500 W bins) that the residential catalog
// deliberately filtered out — but that file is NOT in this repo. Every entry
// below is therefore marked "placeholder — confirm". When the owner re-provides
// the spreadsheet, replace specs with real DB rows and change the tag to
// "from owner DB".
//
// Derate rule (same as residential): system derate = device efficiency × 0.88
// environmental losses. NEVER present device efficiency alone as system output.

export const COMMERCIAL_PANEL_PRODUCTS = [
  { id: "jinko_tiger_neo_72hl4_bdv_575_610", mfr: "Jinko Solar", name: "Tiger Neo 72HL4-BDV 575–610 W", watts: 590, eff: 22.4, note: "placeholder — confirm · N-type TOPCon bifacial 144-cell · utility/commercial format · 12 yr product / 30 yr power" },
  { id: "longi_hi_mo_x6_lr5_72hth_560_580", mfr: "LONGi Solar", name: "Hi-MO X6 LR5-72HTH 560–580 W", watts: 575, eff: 22.3, note: "placeholder — confirm · N-type TOPCon 144-cell commercial format · 15 yr product / 30 yr power" },
  { id: "canadian_tophiku6_cs6w_570_590", mfr: "Canadian Solar", name: "TOPHiKu6 CS6W-570~590T", watts: 580, eff: 22.5, note: "placeholder — confirm · N-type TOPCon 144-cell · commercial/utility · 12 yr product / 30 yr power" },
  { id: "trina_vertex_tsm_de21_550_605", mfr: "Trina Solar", name: "Vertex TSM-DE21 550–605 W", watts: 585, eff: 21.9, note: "placeholder — confirm · Mono PERC 132-cell large-format · 12 yr product / 30 yr power" },
  { id: "trina_vertex_n_tsm_neg21c_20_670_700", mfr: "Trina Solar", name: "Vertex N TSM-NEG21C.20 670–700 W", watts: 690, eff: 22.5, note: "placeholder — confirm · N-type TOPCon bifacial 132-cell · largest commercial bin · 12 yr product / 30 yr power" },
  { id: "ja_solar_deepblue_40_pro_565_590", mfr: "JA Solar", name: "DeepBlue 4.0 Pro 565–590 W", watts: 580, eff: 22.4, note: "placeholder — confirm · N-type Bycium+ 144-cell · commercial format · 12 yr product / 30 yr power" },
  { id: "q_cells_q_peak_duo_xl_g11_570_590", mfr: "Q.Cells", name: "Q.PEAK DUO XL-G11.7/BFG 570–590 W", watts: 580, eff: 22.2, note: "placeholder — confirm · Mono PERC bifacial XL commercial · 25 yr product + power" },
  { id: "heliene_hx550p_144_550_w_bifacial", mfr: "Heliene", name: "HX550P-144 550 W Bifacial", watts: 550, eff: 21.4, note: "placeholder — confirm · Mono PERC bifacial 144-cell · US-manufactured commercial · 12 yr product / 30 yr power" },
];

// Three-phase commercial string inverters. Same derate formula as residential:
// derate = deviceEff × 0.88 environmental losses.
export const COMMERCIAL_INVERTER_PRODUCTS = [
  { id: "sma_sunny_tripower_core1_62", name: "SMA Sunny Tripower CORE1 62-US (3-phase)", arch: "string", deviceEff: 98.0, derate: 0.862, note: "placeholder — confirm · 62 kW 3-phase string · free-standing install · 98.0% device eff → 86.2% system output after real-world losses" },
  { id: "sma_sunny_tripower_x_25", name: "SMA Sunny Tripower X 25-US (3-phase)", arch: "string", deviceEff: 98.0, derate: 0.862, note: "placeholder — confirm · 25 kW 3-phase string · stack for larger arrays · 98.0% device eff → 86.2% system output after real-world losses" },
  { id: "solaredge_se66_6k", name: "SolarEdge SE66.6K + commercial optimizers", arch: "optimizer", deviceEff: 98.5, derate: 0.867, note: "placeholder — confirm · 66.6 kW 3-phase with panel-level optimization · 98.5% device eff → 86.7% system output after real-world losses" },
  { id: "solaredge_se33_3k", name: "SolarEdge SE33.3K + commercial optimizers", arch: "optimizer", deviceEff: 98.5, derate: 0.867, note: "placeholder — confirm · 33.3 kW 3-phase · panel-level monitoring · 98.5% device eff → 86.7% system output after real-world losses" },
  { id: "solark_60k_3p", name: "Sol-Ark 60K-3P hybrid (3-phase)", arch: "string", deviceEff: 97.5, derate: 0.858, note: "placeholder — confirm · 60 kW 3-phase hybrid, battery-ready · 97.5% device eff → 85.8% system output after real-world losses" },
];

// Commercial installed-cost tiers ($/W) — editable ESTIMATES, not distributor pricing.
export const COMMERCIAL_COST_TIERS = [
  { maxKw: 100, costPerWatt: 1.90, label: "<100 kW ≈ $1.90/W (estimate)" },
  { maxKw: 500, costPerWatt: 1.60, label: "100–500 kW ≈ $1.60/W (estimate)" },
  { maxKw: Infinity, costPerWatt: 1.40, label: ">500 kW ≈ $1.40/W (estimate)" },
];
