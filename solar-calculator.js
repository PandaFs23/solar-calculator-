const fs = require('fs');
const path = require('path');

// ---- palette ----
const C = {
  night: '#0B1626', slate: '#13233A', cell: '#1C3554', cellLit: '#2C4E7A',
  gold: '#F5B62E', goldSoft: '#F5B62E22', copper: '#E08E45',
  green: '#5BC98C', greenSoft: '#5BC98C22', teal: '#4CC3D9', tealSoft: '#4CC3D922',
  text: '#EAF0F7', dim: '#8FA3BC', line: '#22385A',
};

const UTILITIES = [
  { id: 'sdge', name: 'SDG&E', rate: 0.40, sunHrs: 5.5, region: 'San Diego', link: 'https://myaccount.sdge.com', linkLabel: 'SDG&E My Account' },
  { id: 'pge', name: 'PG&E', rate: 0.42, sunHrs: 5.0, region: 'Northern CA', link: 'https://m.pge.com', linkLabel: 'PG&E Your Account' },
  { id: 'custom', name: 'Other', rate: 0.17, sunHrs: 4.2, region: 'Custom', link: null },
];

const INVERTERS = [
  { id: 'micro', name: 'Microinverter', derate: 0.86, note: 'Per-panel conversion (e.g. Enphase). Best shade tolerance; panel-level monitoring. Expansion: add panels anywhere.' },
  { id: 'optimizer', name: 'Optimizer', derate: 0.87, note: 'DC optimizers + central inverter (e.g. SolarEdge). Panel-level optimization; expansion limited by inverter capacity.' },
  { id: 'string', name: 'String', derate: 0.84, note: 'Panels in series to one inverter. Lowest cost; shade on one panel drags the string; expansion usually needs a second inverter.' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PANEL_PRODUCTS = [
  { id: 'aptos_dna_144_mf10_455w', mfr: 'Aptos Solar', name: 'DNA-144-MF10-455W', watts: 455, eff: 21.5, note: '21.5% module eff · Mono PERC half-cut 144-cell · 12 yr product / 30 yr power' },
  { id: 'aptos_dna_108_mfn10_430w_topcon_us', mfr: 'Aptos Solar', name: 'DNA-108-MFN10-430W TOPCon US', watts: 430, eff: 22.0, note: '22.0% module eff · N-type TOPCon US-manufactured · 25 yr product / 30 yr power' },
  { id: 'aptos_dna_120_mfn10_405w_topcon', mfr: 'Aptos Solar', name: 'DNA-120-MFN10-405W TOPCon', watts: 405, eff: 21.9, note: '21.9% module eff · N-type TOPCon half-cut · 25 yr product / 30 yr power' },
  { id: 'aptos_dna_120_mf10_390w', mfr: 'Aptos Solar', name: 'DNA-120-MF10-390W', watts: 390, eff: 20.8, note: '20.8% module eff · Mono PERC half-cut 120-cell · 12 yr product / 30 yr power' },
  { id: 'auxin_axn_430_nxxx_430_w_topcon', mfr: 'Auxin Solar', name: 'AXN-430-NXXX 430 W TOPCon', watts: 435, eff: 22.0, note: '22.0% module eff · N-type TOPCon US-manufactured · 25 yr product / 30 yr power' },
  { id: 'auxin_axn_400_mxxx_400_w', mfr: 'Auxin Solar', name: 'AXN-400-MXXX 400 W', watts: 410, eff: 20.8, note: '20.8% module eff · Mono PERC half-cut residential · 25 yr product / 30 yr power' },
  { id: 'canadian_hihero_cs6r_420nh', mfr: 'Canadian Solar', name: 'HiHero CS6R-420NH', watts: 425, eff: 22.8, note: '22.8% module eff · N-type HJT residential · 25 yr product / 30 yr power' },
  { id: 'canadian_canadian_solar_us_400_w_us_made', mfr: 'Canadian Solar', name: 'Canadian Solar US 400 W (US-made)', watts: 400, eff: 21.0, note: '21.0% module eff · Mono PERC US domestic · 25 yr product / 25 yr power' },
  { id: 'heliene_hx430n_54_430_w_topcon', mfr: 'Heliene', name: 'HX430N-54 430 W TOPCon', watts: 430, eff: 22.1, note: '22.1% module eff · N-type TOPCon half-cut · 25 yr product / 30 yr power' },
  { id: 'heliene_hx415m_60_bf_415_w_bifacial', mfr: 'Heliene', name: 'HX415M-60-BF 415 W Bifacial', watts: 415, eff: 21.3, note: '21.3% module eff · Mono PERC bifacial 120-cell · 12 yr product / 30 yr power' },
  { id: 'heliene_hx400m_60_400_w', mfr: 'Heliene', name: 'HX400M-60 400 W', watts: 400, eff: 20.7, note: '20.7% module eff · Mono PERC half-cut 120-cell · 12 yr product / 30 yr power' },
  { id: 'illuminate_illuminate_450_w_topcon_bf', mfr: 'Illuminate USA', name: 'ILLUMINATE 450 W TOPCon BF', watts: 455, eff: 22.5, note: '22.5% module eff · N-type TOPCon bifacial · 25 yr product / 30 yr power' },
  { id: 'illuminate_illuminate_430_w_topcon', mfr: 'Illuminate USA', name: 'ILLUMINATE 430 W TOPCon', watts: 430, eff: 22.0, note: '22.0% module eff · N-type TOPCon half-cut · 25 yr product / 30 yr power' },
  { id: 'illuminate_illuminate_400_w_perc', mfr: 'Illuminate USA', name: 'ILLUMINATE 400 W PERC', watts: 400, eff: 20.5, note: '20.5% module eff · Mono PERC half-cut 120-cell · 25 yr product / 30 yr power' },
  { id: 'jinko_tiger_neo_jkm450n_60hl4_v', mfr: 'Jinko Solar', name: 'Tiger Neo JKM450N-60HL4-V', watts: 450, eff: 22.0, note: '22.0% module eff · N-type TOPCon 120-cell · 15 yr product / 30 yr power' },
  { id: 'jinko_tiger_neo_jkm420n_54hl4_v', mfr: 'Jinko Solar', name: 'Tiger Neo JKM420N-54HL4-V', watts: 420, eff: 21.6, note: '21.6% module eff · N-type TOPCon half-cut · 15 yr product / 30 yr power' },
  { id: 'jinko_tiger_pro_jkm410m_54hl4', mfr: 'Jinko Solar', name: 'Tiger Pro JKM410M-54HL4', watts: 410, eff: 21.0, note: '21.0% module eff · Mono PERC half-cut 108-cell · 12 yr product / 25 yr power' },
  { id: 'jinko_tiger_pro_us_jkm410m_54hl4_us', mfr: 'Jinko Solar', name: 'Tiger Pro US JKM410M-54HL4-US', watts: 410, eff: 21.0, note: '21.0% module eff · Mono PERC, US-manufactured · 15 yr product / 30 yr power' },
  { id: 'longi_hi_mo_x6_lr5_54hgx_440_455_w', mfr: 'LONGi Solar', name: 'Hi-MO X6 LR5-54HGX 440–455 W', watts: 455, eff: 22.8, note: '22.8% module eff · N-type TOPCon half-cut · 15 yr product / 30 yr power' },
  { id: 'longi_hi_mo_5m_lr5_54hth_410_425_w', mfr: 'LONGi Solar', name: 'Hi-MO 5m LR5-54HTH 410–425 W', watts: 425, eff: 21.3, note: '21.3% module eff · Mono PERC half-cut 108-cell · 15 yr product / 30 yr power' },
  { id: 'mission_edge_msmd430n_54hl_430_w', mfr: 'Mission Solar', name: 'EDGE+ MSMD430N-54HL 430 W', watts: 430, eff: 22.0, note: '22.0% module eff · N-type TOPCon half-cut · 25 yr product / 30 yr power' },
  { id: 'mission_edge_msmd410m_72hl_410_w', mfr: 'Mission Solar', name: 'EDGE MSMD410M-72HL 410 W', watts: 410, eff: 21.0, note: '21.0% module eff · Mono PERC half-cut 144-cell · 10 yr product / 25 yr power' },
  { id: 'mission_edge_msmd395m_72h_395_w', mfr: 'Mission Solar', name: 'EDGE MSMD395M-72H 395 W', watts: 395, eff: 20.4, note: '20.4% module eff · Mono PERC half-cut 144-cell · 10 yr product / 25 yr power' },
  { id: 'q_cells_q_home_next_l_g3_420_435_w', mfr: 'Q.Cells', name: 'Q.HOME NEXT L-G3 420–435 W', watts: 435, eff: 21.4, note: '21.4% module eff · Mono PERC residential premium · 25 yr product + power' },
  { id: 'q_cells_q_peak_duo_xl_g10_400_415_w', mfr: 'Q.Cells', name: 'Q.PEAK DUO XL-G10+ 400–415 W', watts: 415, eff: 21.0, note: '21.0% module eff · Mono PERC half-cut XL, 156-cell · 25 yr product + power' },
  { id: 'q_cells_q_peak_duo_ml_g10_bfg_390_405_w', mfr: 'Q.Cells', name: 'Q.PEAK DUO ML-G10+ 390–405 W', watts: 405, eff: 21.0, note: '21.0% module eff · Mono PERC bifacial · 25 yr product + power' },
  { id: 'q_cells_q_peak_duo_ml_g10_370_380_w', mfr: 'Q.Cells', name: 'Q.PEAK DUO ML-G10+ 370–380 W', watts: 380, eff: 20.4, note: '20.4% module eff · Mono PERC half-cut, 144-cell · 25 yr product + power' },
  { id: 'rec_rec_alpha_4_430_455_w', mfr: 'REC Group', name: 'REC Alpha 4 430–455 W', watts: 455, eff: 22.8, note: '22.8% module eff · HJT next-gen · 20 yr product / 25 yr power' },
  { id: 'rec_rec_alpha_pure_r_410_430_w', mfr: 'REC Group', name: 'REC Alpha Pure-R 410–430 W', watts: 430, eff: 22.3, note: '22.3% module eff · HJT all-black · 20 yr product / 25 yr power' },
  { id: 'rec_rec_alpha_380_405_w', mfr: 'REC Group', name: 'REC Alpha 380–405 W', watts: 405, eff: 21.7, note: '21.7% module eff · HJT heterojunction (HJT) · 20 yr product / 25 yr power' },
  { id: 'rec_rec_twinpeak_4_385_400_w', mfr: 'REC Group', name: 'REC TwinPeak 4 385–400 W', watts: 400, eff: 20.5, note: '20.5% module eff · Mono PERC half-cut 144-cell · 10 yr product / 25 yr power' },
  { id: 'sharp_nu_jh450_450_w_standard', mfr: 'Sharp Solar', name: 'NU-JH450 450 W (Standard)', watts: 450, eff: 21.6, note: '21.6% module eff · Mono PERC half-cut 144-cell · 12 yr product / 25 yr power' },
  { id: 'sharp_nb_jh445k_n_445_w_topcon', mfr: 'Sharp Solar', name: 'NB-JH445K-N 445 W TOPCon', watts: 450, eff: 22.5, note: '22.5% module eff · N-type TOPCon half-cut all-black · 25 yr product / 30 yr power' },
  { id: 'sharp_nb_jh430k_430_w_all_black', mfr: 'Sharp Solar', name: 'NB-JH430K 430 W (All-Black)', watts: 430, eff: 21.8, note: '21.8% module eff · Mono PERC half-cut all-black 144-cell · 12 yr product / 25 yr power' },
  { id: 'sharp_nb_jh415k_415_w_all_black', mfr: 'Sharp Solar', name: 'NB-JH415K 415 W (All-Black)', watts: 415, eff: 21.3, note: '21.3% module eff · Mono PERC half-cut all-black 144-cell · 12 yr product / 25 yr power' },
  { id: 'silfab_prime_elite_sil_prime_430_w', mfr: 'Silfab Solar', name: 'Prime Elite SIL-PRIME 430 W', watts: 430, eff: 22.0, note: '22.0% module eff · N-type TOPCon half-cut · 25 yr product / 30 yr power' },
  { id: 'silfab_slg_m_415_w', mfr: 'Silfab Solar', name: 'SLG-M 415 W', watts: 415, eff: 21.2, note: '21.2% module eff · Mono PERC half-cut all-black · 12 yr product / 30 yr power' },
  { id: 'silfab_sla_m_400_w', mfr: 'Silfab Solar', name: 'SLA-M 400 W', watts: 400, eff: 20.5, note: '20.5% module eff · Mono PERC half-cut 120-cell · 12 yr product / 30 yr power' },
  { id: 'silfab_sla_m_380_w', mfr: 'Silfab Solar', name: 'SLA-M 380 W', watts: 380, eff: 19.6, note: '19.6% module eff · Mono PERC half-cut 120-cell · 12 yr product / 30 yr power' },
  { id: 'solar4america_ivy_440n_132hd_topcon', mfr: 'Solar4America', name: 'IVY 440N-132HD TOPCon', watts: 440, eff: 22.5, note: '22.5% module eff · N-type TOPCon US-manufactured · 25 yr product / 30 yr power' },
  { id: 'solar4america_ivy_420m_132bf_420_w_bifac', mfr: 'Solar4America', name: 'IVY 420M-132BF 420 W Bifacial', watts: 420, eff: 21.0, note: '21.0% module eff · Mono PERC bifacial 132-cell · 25 yr product / 30 yr power' },
  { id: 'solar4america_ivy_400m_108hd_400_w', mfr: 'Solar4America', name: 'IVY 400M-108HD 400 W', watts: 400, eff: 20.7, note: '20.7% module eff · Mono PERC half-cut 108-cell · 25 yr product / 30 yr power' },
  { id: 'sunpower_maxeon_7_440_w', mfr: 'SunPower', name: 'Maxeon 7 440 W', watts: 440, eff: 24.1, note: '24.1% module eff · Mono IBC Maxeon Gen 7 · 25 yr product / 40 yr power' },
  { id: 'sunpower_maxeon_6_420_w', mfr: 'SunPower', name: 'Maxeon 6 420 W', watts: 420, eff: 22.8, note: '22.8% module eff · Mono IBC Maxeon Gen 6 · 25 yr product / 40 yr power' },
  { id: 'sunpower_maxeon_3_400_w', mfr: 'SunPower', name: 'Maxeon 3 400 W', watts: 400, eff: 22.7, note: '22.7% module eff · Mono IBC Maxeon Gen 3 · 25 yr product / 40 yr power' },
  { id: 'sunpower_maxeon_3_blk_400_w', mfr: 'SunPower', name: 'Maxeon 3 BLK 400 W', watts: 400, eff: 22.7, note: '22.7% module eff · Mono IBC Maxeon Gen 3, all-black · 25 yr product / 40 yr power' },
  { id: 't1_t1_430_w_topcon', mfr: 'T1 Energy', name: 'T1 430 W TOPCon', watts: 430, eff: 22.0, note: '22.0% module eff · N-type TOPCon half-cut · 25 yr product / 30 yr power' },
  { id: 't1_t1_400_w_perc', mfr: 'T1 Energy', name: 'T1 400 W PERC', watts: 400, eff: 20.7, note: '20.7% module eff · Mono PERC half-cut 120-cell · 25 yr product / 30 yr power' },
  { id: 'tesla_tesla_solar_panel_420_w_gen_3', mfr: 'Tesla & SolarCity', name: 'Tesla Solar Panel 420 W (Gen 3)', watts: 420, eff: 21.0, note: '21.0% module eff · Mono c-Si PERC, black-on-black · 25 yr product + power' },
  { id: 'trina_neg9r_28_tsm_neg9r_28_430_445_w', mfr: 'Trina Solar', name: 'NEG9R.28 TSM-NEG9R.28 430–445 W', watts: 445, eff: 22.3, note: '22.3% module eff · N-type TOPCon half-cut · 15 yr product / 30 yr power' },
  { id: 'trina_vertex_s_tsm_de09r_400_420_w', mfr: 'Trina Solar', name: 'Vertex S TSM-DE09R 400–420 W', watts: 420, eff: 21.1, note: '21.1% module eff · Mono PERC half-cut residential · 15 yr product / 30 yr power' },
  { id: 'waaree_waaree_topcon_450_w', mfr: 'Waaree Solar', name: 'Waaree TOPCon 450 W', watts: 455, eff: 22.3, note: '22.3% module eff · N-type TOPCon half-cut · 25 yr product / 30 yr power' },
  { id: 'waaree_navitas_420_440_w_bifacial', mfr: 'Waaree Solar', name: 'Navitas 420–440 W Bifacial', watts: 440, eff: 21.0, note: '21.0% module eff · Mono PERC bifacial 120-cell · 12 yr product / 30 yr power' },
  { id: 'waaree_navitas_380_405_w_mono_perc', mfr: 'Waaree Solar', name: 'Navitas 380–405 W Mono PERC', watts: 405, eff: 20.5, note: '20.5% module eff · Mono PERC half-cut 120-cell · 12 yr product / 30 yr power' },
  { id: 'waaree_waaree_us_400_w_us_manufactured', mfr: 'Waaree Solar', name: 'Waaree US 400 W (US-manufactured)', watts: 400, eff: 20.7, note: '20.7% module eff · Mono PERC US domestic · 25 yr product / 30 yr power' },
];

const INVERTER_PRODUCTS = [
  { id: 'enphase_iq8plus', name: 'Enphase IQ8+ microinverters', arch: 'micro', deviceEff: 97.6, derate: 0.859, note: '290 W AC per panel · 25-yr warranty · per-panel monitoring · 97.6% device eff → 85.9% system output after real-world losses' },
  { id: 'enphase_iq8m', name: 'Enphase IQ8M microinverters', arch: 'micro', deviceEff: 97.6, derate: 0.859, note: '366 W AC per panel · 25-yr warranty · fits 400-450 W panels · 97.6% device eff → 85.9% system output after real-world losses' },
  { id: 'enphase_iq8h', name: 'Enphase IQ8H microinverters', arch: 'micro', deviceEff: 97.6, derate: 0.859, note: '330 W AC per panel · 25-yr warranty · high-power panels · 97.6% device eff → 85.9% system output after real-world losses' },
  { id: 'hoymiles_hms2000', name: 'Hoymiles HMS-2000W-4T quad micro', arch: 'micro', deviceEff: 97.1, derate: 0.854, note: 'One unit runs 4 panels · 25-yr warranty · budget micro option · 97.1% device eff → 85.4% system output after real-world losses' },
  { id: 'solaredge_hub76', name: 'SolarEdge Home Hub 7.6 kW + S440 optimizers', arch: 'optimizer', deviceEff: 99.0, derate: 0.871, note: '99% CEC eff · DC-coupled battery-ready · 12-25 yr warranty · 99.0% device eff → 87.1% system output after real-world losses' },
  { id: 'solaredge_hub114', name: 'SolarEdge Home Hub 11.4 kW + S440 optimizers', arch: 'optimizer', deviceEff: 99.0, derate: 0.871, note: 'Large homes · 99% CEC eff · DC-coupled battery-ready · 12-25 yr warranty · 99.0% device eff → 87.1% system output after real-world losses' },
  { id: 'tesla_pw3_int', name: 'Tesla Powerwall 3 integrated inverter', arch: 'string', deviceEff: 97.5, derate: 0.858, note: 'Solar inverter built into PW3 · cleanest install when pairing PW3 · 97.5% device eff → 85.8% system output after real-world losses' },
  { id: 'solark_15k', name: 'Sol-Ark 15K-2P hybrid', arch: 'string', deviceEff: 97.5, derate: 0.858, note: '15 kW AC / 22.5 kW peak · whole-home hybrid · 10-yr warranty · 97.5% device eff → 85.8% system output after real-world losses' },
];

const BATTERY_PRODUCTS = [
  { id: 'pw3', name: 'Tesla Powerwall 3', unitKwh: 13.5, unitKw: 11.5, rtEff: 97.5, price: 13500, note: 'Built-in 11.5 kW solar inverter · stackable to 4 · 10-yr unlimited-cycle warranty · 97.5% round-trip · price is a $1,000/kWh installed ESTIMATE' },
  { id: 'enphase_5p', name: 'Enphase IQ Battery 5P', unitKwh: 5.0, unitKw: 3.84, rtEff: 89, price: 5000, note: 'LFP chemistry · modular small blocks · 10-yr warranty · 89% round-trip · price is a $1,000/kWh installed ESTIMATE' },
  { id: 'enphase_10', name: 'Enphase IQ Battery 10', unitKwh: 10.08, unitKw: 3.84, rtEff: 89, price: 10000, note: '3.84 kW continuous · IQ System Controller required · 10-yr warranty · 89% round-trip · price is a $1,000/kWh installed ESTIMATE' },
  { id: 'se_home97', name: 'SolarEdge Home Battery 9.7', unitKwh: 9.7, unitKw: 5.0, rtEff: 95, price: 9500, note: '5 kW cont / 7.5 kW peak · DC-coupled with Home Hub · 10-yr warranty · 95% round-trip · price is a $1,000/kWh installed ESTIMATE' },
  { id: 'generac_9', name: 'Generac PWRcell 2 (9 kWh)', unitKwh: 9.0, unitKw: 4.5, rtEff: 96.5, price: 9000, note: 'LFP · stackable to 36 kWh · 10-yr warranty · 96.5% round-trip · price is a $1,000/kWh installed ESTIMATE' },
  { id: 'generac_18', name: 'Generac PWRcell 2 (18 kWh)', unitKwh: 18.0, unitKw: 9.0, rtEff: 96.5, price: 18000, note: 'Dual-stack single cabinet · 9 kW continuous · 10-yr warranty · 96.5% round-trip · price is a $1,000/kWh installed ESTIMATE' },
  { id: 'epcube', name: 'Canadian Solar EP Cube', unitKwh: 10.24, unitKw: 5.12, rtEff: 92, price: 10000, note: 'LFP wall-mount · 5.12 kW max · 10-yr warranty · 92% round-trip · price is a $1,000/kWh installed ESTIMATE' },
  { id: 'sunvault_13', name: 'SunPower SunVault 13', unitKwh: 13.0, unitKw: 5.12, rtEff: 90, price: 13000, note: 'SolarEdge inverter inside · 5.12 kW cont · 10-yr warranty · 90% round-trip · price is a $1,000/kWh installed ESTIMATE' },
  { id: 'tigo_99', name: 'Tigo EI Battery 9.9', unitKwh: 9.9, unitKw: 5.0, rtEff: 96, price: 10000, note: 'LFP DC-coupled · 5 kW cont / 6 kW peak · 11-yr warranty · 96% round-trip · price is a $1,000/kWh installed ESTIMATE' },
  { id: 'eg4_wm280', name: 'EG4 WallMount 280Ah (14.3 kWh)', unitKwh: 14.3, unitKw: 6.0, rtEff: 96, price: 14500, note: 'LFP · pairs with EG4 18kPV hybrid (output inverter-limited, ~6 kW est.) · 10-yr warranty · 96% round-trip · price is a $1,000/kWh installed ESTIMATE' },
];

const SYS_CONFIGS = [
  { id: 'whole', name: 'Whole-Home Backup', blurb: 'Everything stays on in an outage — AC, well pump, EV, all of it. Battery bank sized to the home\'s full peak load.', sets: 'All active loads → backup · Powerwall 3 · units auto-sized to peak kW' },
  { id: 'partial', name: 'Partial Backup', blurb: 'A critical-loads panel keeps essentials running: fridge, lights, WiFi, medical. The most cost-effective resilience.', sets: 'Essential loads → backup · 1 battery unit · critical-loads panel' },
  { id: 'tou', name: 'TOU / Self-Consumption', blurb: 'Battery cycles daily — stores midday solar, discharges at expensive evening rates. Built for NEM 3.0 economics, not outages.', sets: 'No backup loads · 1 battery unit · maximizes rate arbitrage' },
  { id: 'backuponly', name: 'Backup-Only (no new solar)', blurb: 'Battery charges from the grid (or existing solar) purely for outage protection. Zero new panels.', sets: 'New array → 0 panels · essentials backed up · battery sized to those loads' },
];

const SEASON = [0.72, 0.82, 0.98, 1.10, 1.18, 1.22, 1.24, 1.20, 1.08, 0.92, 0.76, 0.68];
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const USE_SEASON = [0.98, 0.92, 0.90, 0.90, 0.96, 1.05, 1.15, 1.18, 1.10, 0.98, 0.92, 0.96];
const SCALE_TOTAL = DAYS.reduce((s, d, i) => s + d * SEASON[i], 0);

const DERATE = 0.8;
const COST_PER_WATT = 2.75;
const TAX_CREDIT = 0.30;
const PANEL_SQFT = 20;
const RATE_ESCALATION = 0.04;
const DEGRADATION = 0.005;
const EXPORT_RATE = 0.08;
const BATT_EFF = 0.90;
const BATT_UTIL = 0.80;
const SOLAR_HOUR_SHARE = 0.45;
const BATT_COST_KWH = 1000;
const BATT_KW_PER_KWH = 0.5;
const EV_MI_PER_KWH = 3.5;

const APPLIANCES = [
  { id: 'ev', name: 'EV charger (Level 2)', watts: 7700, kwhYr: 0, backupDefault: false, ev: true },
  { id: 'ac', name: 'Central AC', watts: 3500, kwhYr: 2000, backupDefault: false },
  { id: 'heatpump', name: 'Heat pump (heating)', watts: 3000, kwhYr: 2500, backupDefault: false },
  { id: 'waterheater', name: 'Electric water heater', watts: 4000, kwhYr: 1800, backupDefault: false },
  { id: 'pool', name: 'Pool pump', watts: 1500, kwhYr: 2200, backupDefault: false },
  { id: 'fridge', name: 'Refrigerator / freezer', watts: 150, kwhYr: 500, backupDefault: true },
  { id: 'range', name: 'Electric range / oven', watts: 2500, kwhYr: 450, backupDefault: false },
  { id: 'laundry', name: 'Washer + electric dryer', watts: 3500, kwhYr: 700, backupDefault: false },
  { id: 'dishwasher', name: 'Dishwasher', watts: 1500, kwhYr: 250, backupDefault: false },
  { id: 'welllpump', name: 'Well pump', watts: 1000, kwhYr: 700, backupDefault: true },
  { id: 'hottub', name: 'Hot tub / spa', watts: 4000, kwhYr: 2000, backupDefault: false },
  { id: 'lights', name: 'Lighting (whole home)', watts: 200, kwhYr: 400, backupDefault: true },
  { id: 'electronics', name: 'Electronics / WiFi / TV', watts: 250, kwhYr: 600, backupDefault: true },
  { id: 'medical', name: 'Medical equipment', watts: 400, kwhYr: 300, backupDefault: true },
  { id: 'custom', name: 'Other / custom load', watts: 500, kwhYr: 500, backupDefault: false },
];

function findById(list, id, fallback = null) {
  return list.find((item) => item.id === id) || fallback;
}

function getWatts(appliance, loadVals = {}) {
  return (loadVals[appliance.id] && typeof loadVals[appliance.id].watts === 'number')
    ? loadVals[appliance.id].watts
    : appliance.watts;
}

function getKwhYr(appliance, evMiles, loadVals = {}) {
  if (appliance.ev) {
    return typeof evMiles === 'number' && evMiles >= 0 ? evMiles / EV_MI_PER_KWH : appliance.kwhYr;
  }
  return (loadVals[appliance.id] && typeof loadVals[appliance.id].kwhYr === 'number')
    ? loadVals[appliance.id].kwhYr
    : appliance.kwhYr;
}

function round(value) {
  return Math.round(value);
}

function safeNumber(value, fallback = 0) {
  return typeof value === 'number' && !Number.isNaN(value) ? value : fallback;
}

function calculateSolarSizing(options = {}) {
  const defaultOptions = {
    utilityId: 'sdge',
    inputMode: 'kwh',
    annualKwh: 8400,
    bill: 280,
    rate: UTILITIES[0].rate,
    sunHrs: UTILITIES[0].sunHrs,
    panels: null,
    panelProdId: 'q_cells_q_home_next_l_g3_420_435_w',
    invProdId: 'enphase_iq8m',
    battProdId: 'pw3',
    battUnits: 1,
    hasExisting: false,
    existKw: 4.0,
    existType: 'micro',
    existAge: 5,
    existProdOverride: null,
    battMode: 'none',
    battKwh: 13.5,
    loads: {},
    evMiles: 12000,
    loadVals: {},
  };

  const opts = { ...defaultOptions, ...options };
  const utility = findById(UTILITIES, opts.utilityId, UTILITIES[0]);
  const inverter = findById(INVERTERS, opts.existType, INVERTERS[0]);
  const panelProd = findById(PANEL_PRODUCTS, opts.panelProdId, PANEL_PRODUCTS[0]);
  const invProd = findById(INVERTER_PRODUCTS, opts.invProdId, INVERTER_PRODUCTS[0]);
  const battProd = findById(BATTERY_PRODUCTS, opts.battProdId, BATTERY_PRODUCTS[0]);

  const safeRate = Math.max(safeNumber(opts.rate, utility.rate), 0.01);
  const sunHrs = safeNumber(opts.sunHrs, utility.sunHrs);
  const panelW = panelProd.watts;

  let loadsNow = 0;
  let loadsFuture = 0;
  APPLIANCES.forEach((appliance) => {
    const status = opts.loads?.[appliance.id]?.status;
    const value = getKwhYr(appliance, opts.evMiles, opts.loadVals);
    if (status === 'now') loadsNow += value;
    if (status === 'future') loadsFuture += value;
  });

  const baseUsage = opts.inputMode === 'loads'
    ? Math.max(loadsNow, 500)
    : opts.inputMode === 'kwh'
      ? safeNumber(opts.annualKwh, 0)
      : (safeNumber(opts.bill, 0) / safeRate) * 12;

  const annualUsage = baseUsage;
  const sizingUsage = annualUsage + loadsFuture;
  const monthlyKwh = annualUsage / 12;
  const estMonthlyBill = monthlyKwh * safeRate;

  let existProd = 0;
  if (opts.hasExisting) {
    const eff = inverter.derate * Math.pow(1 - DEGRADATION, safeNumber(opts.existAge, 0));
    existProd = typeof opts.existProdOverride === 'number' && opts.existProdOverride > 0
      ? opts.existProdOverride
      : safeNumber(opts.existKw, 0) * sunHrs * eff * 365;
  }

  const existOffsetPct = sizingUsage > 0 ? (existProd / sizingUsage) * 100 : 0;
  const existPanels = opts.hasExisting ? Math.round((safeNumber(opts.existKw, 0) * 1000) / panelW) : 0;

  const remainingKwh = Math.max(sizingUsage - existProd, 0);
  const autoKw = sunHrs > 0 && invProd.derate > 0 ? (remainingKwh / 365) / (sunHrs * invProd.derate) : 0;
  const autoPanels = Math.ceil((autoKw * 1000) / panelW);
  const nPanels = typeof opts.panels === 'number' && opts.panels > 0 ? Math.max(0, Math.round(opts.panels)) : autoPanels;
  const actualKw = (nPanels * panelW) / 1000;
  const newProd = actualKw * sunHrs * invProd.derate * 365;
  const newOffsetPct = sizingUsage > 0 ? (newProd / sizingUsage) * 100 : 0;
  const combinedProd = existProd + newProd;
  const offsetPct = sizingUsage > 0 ? (combinedProd / sizingUsage) * 100 : 0;

  const hasBatt = opts.battMode !== 'none';
  const battKwhEff = opts.battMode === 'new' ? safeNumber(opts.battUnits, 0) * battProd.unitKwh : safeNumber(opts.battKwh, 0);
  const daytimeSurplus = Math.max(combinedProd - sizingUsage * SOLAR_HOUR_SHARE, 0);
  const shiftable = hasBatt ? Math.min(battKwhEff * 365 * BATT_UTIL, daytimeSurplus) : 0;
  const battSavings = shiftable * BATT_EFF * Math.max(safeRate - EXPORT_RATE, 0);
  const avgLoadKw = sizingUsage / 8760;
  const backupHours = hasBatt && avgLoadKw > 0 ? battKwhEff / avgLoadKw : 0;
  const battCost = opts.battMode === 'new' ? safeNumber(opts.battUnits, 0) * battProd.price : 0;

  const backupLoads = APPLIANCES.filter((appliance) => {
    const load = opts.loads?.[appliance.id];
    return load && load.status !== 'no' && load.backup;
  }).map((appliance) => ({
    ...appliance,
    watts: getWatts(appliance, opts.loadVals),
    annual: getKwhYr(appliance, opts.evMiles, opts.loadVals),
  }));

  const backupWatts = backupLoads.reduce((sum, item) => sum + item.watts, 0);
  const backupDailyKwh = backupLoads.reduce((sum, item) => sum + item.annual, 0) / 365;
  const invKw = opts.battMode === 'new' ? safeNumber(opts.battUnits, 0) * battProd.unitKw : battKwhEff * BATT_KW_PER_KWH;
  const backupOk = invKw > 0 ? (backupWatts / 1000) <= invKw : false;
  const backupHrsCritical = hasBatt && backupDailyKwh > 0 ? (battKwhEff * 0.9) / backupDailyKwh * 24 : 0;

  const grossCost = actualKw * 1000 * COST_PER_WATT + battCost;
  const netCost = grossCost * (1 - TAX_CREDIT);
  const billedBefore = Math.max(sizingUsage - existProd, 0);
  const billedAfter = Math.max(sizingUsage - combinedProd, 0);
  const solarSavings = (billedBefore - billedAfter) * safeRate;
  const newBattSavings = opts.battMode === 'new' ? battSavings : 0;
  const annualSavings = solarSavings + newBattSavings;
  const payback = annualSavings > 0 && netCost > 0 ? netCost / annualSavings : 0;
  const roofArea = nPanels * PANEL_SQFT;

  const monthly = MONTHS.map((month, i) => {
    const scale = (DAYS[i] * SEASON[i]) / SCALE_TOTAL;
    return {
      month,
      existing: round(existProd * scale),
      newSolar: round(newProd * scale),
      usage: round((sizingUsage / 12) * USE_SEASON[i]),
    };
  });

  let cum = 0;
  const savings = [];
  for (let year = 0; year <= 25; year += 1) {
    if (year > 0) {
      const yearRate = safeRate * Math.pow(1 + RATE_ESCALATION, year - 1);
      const deg = Math.pow(1 - DEGRADATION, year - 1);
      const before = Math.max(sizingUsage - existProd * deg, 0);
      const after = Math.max(sizingUsage - combinedProd * deg, 0);
      const battY = newBattSavings * Math.pow(1 + RATE_ESCALATION, year - 1);
      cum += (before - after) * yearRate + battY;
    }
    savings.push({ year, saved: round(cum), cost: round(netCost) });
  }

  return {
    utility,
    inverter,
    panelProd,
    invProd,
    battProd,
    monthlyKwh,
    annualUsage,
    sizingUsage,
    loadsNow,
    loadsFuture,
    estMonthlyBill,
    nPanels,
    autoPanels,
    actualKw,
    existProd,
    existOffsetPct,
    existPanels,
    newProd,
    newOffsetPct,
    offsetPct,
    battSavings,
    backupHours,
    battCost,
    shiftable,
    battKwhEff,
    backupLoads,
    backupWatts,
    backupDailyKwh,
    invKw,
    backupOk,
    backupHrsCritical,
    grossCost,
    netCost,
    annualSavings,
    payback,
    roofArea,
    monthly,
    savings,
    savings25: cum,
  };
}

function usage() {
  return `Usage:
  node solar-calculator.js [input.json | '{...}']

Examples:
  node solar-calculator.js sample
  node solar-calculator.js '{"inputMode":"kwh","annualKwh":8400}'
  node solar-calculator.js ./solar-input.json
`;
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.log(usage());
    return;
  }

  let input = null;
  if (arg === 'sample') {
    input = {
      utilityId: 'sdge',
      inputMode: 'kwh',
      annualKwh: 8400,
      rate: 0.40,
      sunHrs: 5.5,
      panelProdId: 'q_cells_q_home_next_l_g3_420_435_w',
      invProdId: 'enphase_iq8m',
      battMode: 'new',
      battProdId: 'pw3',
      battUnits: 1,
      loads: {
        fridge: { status: 'now', backup: true },
        lights: { status: 'now', backup: true },
        electronics: { status: 'now', backup: true },
      },
    };
  } else if (arg.trim().startsWith('{')) {
    try {
      input = JSON.parse(arg);
    } catch (err) {
      console.error('Invalid JSON string provided.');
      process.exit(1);
    }
  } else {
    const filePath = path.resolve(arg);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      input = JSON.parse(content);
    } catch (err) {
      console.error(`Could not read input file: ${filePath}`);
      process.exit(1);
    }
  }

  const result = calculateSolarSizing(input);
  console.log(JSON.stringify(result, null, 2));
}

module.exports = {
  C,
  UTILITIES,
  INVERTERS,
  PANEL_PRODUCTS,
  INVERTER_PRODUCTS,
  BATTERY_PRODUCTS,
  APPLIANCES,
  calculateSolarSizing,
};

if (require.main === module) {
  main();
}
