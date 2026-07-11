// Solar rules & incentives directory: curated links to self-maintaining authoritative
// sources (DSIRE, .gov, SEIA), never paraphrased legal claims. See CLAUDE.md "Regulations
// data" section. Every url in this file is checked by `npm run check-links`.
import { STATE_CODES } from "./utilities.js";

export const STATE_NAMES = Object.fromEntries(
  Object.entries(STATE_CODES).map(([name, code]) => [code, name])
);

function googleSearchUrl(query) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

export const FEDERAL_FUN_FACT =
  "Residential and commercial solar now run on completely different federal tax-credit clocks — the homeowner credit is gone, the business credit isn't (yet).";

export const FEDERAL_ITEMS = [
  {
    name: "IRS — Residential Clean Energy Credit (Section 25D)",
    url: "https://www.irs.gov/credits-deductions/residential-clean-energy-credit",
    note: "This 30% homeowner credit ended for property placed in service after Dec 31, 2025 — repealed years early by the One Big Beautiful Bill Act. Unused credit from a pre-2026 install can still be carried forward; this page has the current rules.",
    funFact: "The federal 30% tax credit for home solar is gone — it expired at the end of 2025, seven years ahead of its original 2032 schedule.",
    verified: "2026-07-10",
  },
  {
    name: "IRS — Clean Electricity Investment Credit (Section 48E, commercial/business)",
    url: "https://www.irs.gov/credits-deductions/clean-electricity-investment-credit",
    note: "The business-side solar ITC is still active, but construction-start timing matters: projects starting construction after July 4, 2026 must be placed in service by Dec 31, 2027 to qualify, and foreign-sourcing content thresholds apply starting at 40% for 2026. Confirm current dates here before quoting a rate.",
    verified: "2026-07-10",
  },
  {
    name: "IRS — Form 3468, Investment Credit",
    url: "https://www.irs.gov/forms-pubs/about-form-3468",
    note: "The form used to actually claim the business ITC (Section 48/48E) on a return.",
    verified: "2026-07-10",
  },
  {
    name: "DSIRE — MACRS accelerated depreciation for solar",
    url: "https://programs.dsireusa.org/system/program/detail/676",
    note: "5-year accelerated depreciation schedule for commercial solar equipment — paired with the ITC, this is the other half of the commercial tax benefit.",
    verified: "2026-07-10",
  },
  {
    name: "energy.gov — Homeowner's Guide to the Federal Solar Tax Credit",
    url: "https://www.energy.gov/sites/prod/files/2021/02/f82/Guide%20to%20Federal%20Tax%20Credit%20for%20Residential%20Solar%20PV%20-%202021.pdf",
    note: "DOE's plain-language walkthrough of how the credit used to work — written before the 2025 repeal, so treat the \"still available\" framing as historical and check the IRS page above for current status.",
    verified: "2026-07-10",
  },
  {
    name: "DSIRE — federal renewable energy programs",
    url: "https://programs.dsireusa.org/system/program?state=US",
    note: "Every federal incentive and policy DSIRE tracks, filterable by technology and sector — the self-updating source of record.",
    verified: "2026-07-10",
  },
];

export const STATE_REGS = {
  CA: {
    funFact:
      "California's Solar Rights Act has barred HOAs from banning solar since 1978, and if yours doesn't respond to an application within 45 days, it's automatically approved.",
    categories: {
      netMetering: [
        {
          name: "CPUC — Net Billing (successor to net metering)",
          url: "https://www.cpuc.ca.gov/nem/",
          note: "California's current export-compensation tariff for new residential solar, replacing the old one-to-one net metering credit with avoided-cost-based rates.",
          verified: "2026-07-10",
        },
      ],
      hoaSolarAccess: [
        {
          name: "California Civil Code § 714 — Solar Rights Act",
          url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=714.",
          note: "Voids HOA rules that significantly raise system cost (>$1,000) or cut expected output (>10%); 45 days of HOA silence counts as approval.",
          verified: "2026-07-10",
        },
      ],
      incentives: [
        {
          name: "DSIRE — California incentives & tax exemptions",
          url: "https://programs.dsireusa.org/system/program?state=CA",
          note: "Filter by \"Property Tax Incentive\" — California excludes solar from property-tax reassessment; sales-tax exemptions are narrower (e.g. agricultural systems only).",
          verified: "2026-07-10",
        },
      ],
      permitting: [
        {
          name: "energy.gov — SolarAPP+ instant permitting",
          url: "https://www.energy.gov/eere/solar/streamlining-solar-permitting-solarapp",
          note: "Federal automated-permitting program many California cities/counties have adopted for same-day residential approval — check with your local building department.",
          verified: "2026-07-10",
        },
      ],
      consumer: [
        {
          name: "CSLB — Verify a solar contractor's license",
          url: "https://www.cslb.ca.gov/Consumers/",
          note: "Contractors State License Board lookup — confirm any installer's C-46 or C-10 license before signing.",
          verified: "2026-07-10",
        },
        {
          name: "CPUC — File a utility complaint",
          url: "https://www.cpuc.ca.gov/consumer-support/file-a-complaint",
          note: "For billing, interconnection, or net-billing disputes with your utility.",
          verified: "2026-07-10",
        },
      ],
    },
  },
  TX: {
    funFact:
      "Texas HOAs can't prohibit solar under Property Code §202.010, but they can push panels off the street-facing roof plane if an alternate spot doesn't cut output by more than 10%.",
    categories: {
      netMetering: [
        {
          name: "Public Utility Commission of Texas",
          url: "https://www.puc.texas.gov/",
          note: "Texas has no statewide net metering mandate. In the deregulated ERCOT market, solar \"buyback\" rates are set individually by each retail electric provider — compare plans before signing. Municipal utilities and co-ops (e.g. Austin Energy, CPS Energy) set their own separate rates.",
          verified: "2026-07-10",
        },
      ],
      hoaSolarAccess: [
        {
          name: "Texas Property Code § 202.010",
          url: "https://statutes.capitol.texas.gov/docs/PR/htm/PR.202.htm",
          note: "HOAs can't ban solar devices outright, but may restrict mounting location or visible frame color unless it would cut output by more than 10%.",
          verified: "2026-07-10",
        },
        {
          name: "Go Solar Texas — Solar Rights & Regulations",
          url: "https://www.gosolartexas.org/solar-rights-regulations",
          note: "State-run plain-language summary of Texas solar rights, permitting, and interconnection.",
          verified: "2026-07-10",
        },
      ],
      incentives: [
        {
          name: "DSIRE — Texas incentives & tax exemptions",
          url: "https://programs.dsireusa.org/system/program?state=TX",
          note: "Texas exempts the added value of a solar install from property tax and has no state income tax; filter by \"Property Tax Incentive\" for details and local utility rebates.",
          verified: "2026-07-10",
        },
      ],
      permitting: [
        {
          name: "energy.gov — SolarAPP+ instant permitting",
          url: "https://www.energy.gov/eere/solar/streamlining-solar-permitting-solarapp",
          note: "Check whether your Texas city or county has adopted SolarAPP+ for same-day permit approval.",
          verified: "2026-07-10",
        },
      ],
      consumer: [
        {
          name: "PUC Texas — File a complaint",
          url: "https://www.puc.texas.gov/consumer/complaint/complaint.aspx",
          note: "For disputes with your retail electric provider or utility over solar billing/interconnection.",
          verified: "2026-07-10",
        },
        {
          name: "TDLR — License search",
          url: "https://www.tdlr.texas.gov/LicenseSearch/",
          note: "Texas doesn't license solar installers specifically, but electricians on the job should be TDLR-licensed — verify here.",
          verified: "2026-07-10",
        },
      ],
    },
  },
  AZ: {
    funFact:
      "Arizona abolished traditional net metering in 2017 for a declining \"net billing\" rate the Corporation Commission resets annually — as of early 2026 that export rate was about 6.2¢/kWh for APS customers.",
    categories: {
      netMetering: [
        {
          name: "DSIRE — Net Metering / Net Billing (Arizona)",
          url: "https://programs.dsireusa.org/system/program/detail/3093/net-metering",
          note: "Tracks the ACC's 2017 shift from net metering to \"net billing\" — export credited at a declining ACC-set rate, not retail. Shows current APS/TEP/UNS export rates.",
          funFact: "A customer's net-billing export rate locks in for 10 years once enrolled, but the rate offered to new customers steps down annually as installed solar capacity grows.",
          verified: "2026-07-10",
        },
        {
          name: "Arizona Corporation Commission — Utilities Division",
          url: "https://azcc.gov/utilities",
          note: "Regulator hub for docket search and rate-case filings covering the ongoing net billing proceeding.",
          verified: "2026-07-10",
        },
      ],
      hoaSolarAccess: [
        {
          name: "Arizona Revised Statutes § 33-1816 — Solar energy devices; reasonable restrictions",
          url: "https://www.azleg.gov/ars/33/01816.htm",
          note: "An HOA \"shall not prohibit the installation or use of a solar energy device,\" though it may set placement/aesthetic rules that don't materially raise cost or cut efficiency.",
          verified: "2026-07-10",
        },
      ],
      incentives: [
        {
          name: "DSIRE — Energy Equipment Property Tax Exemption (Arizona)",
          url: "https://programs.dsireusa.org/system/program/detail/1683/energy-equipment-property-tax-exemption",
          note: "Solar energy devices are assessed as adding no value to the property for AZ property-tax purposes.",
          verified: "2026-07-10",
        },
        {
          name: "DSIRE — Residential Solar and Wind Energy Systems Tax Credit (Arizona)",
          url: "https://programs.dsireusa.org/system/program/detail/118/residential-solar-and-wind-energy-systems-tax-credit",
          note: "State personal income tax credit, separate from and in addition to the federal credit.",
          verified: "2026-07-10",
        },
      ],
      permitting: [
        {
          name: "DSIRE — Solar Contractor Licensing (Arizona)",
          url: "https://programs.dsireusa.org/system/program/detail/244/solar-contractor-licensing",
          verified: "2026-07-10",
        },
        {
          name: "energy.gov — SolarAPP+ instant permitting",
          url: "https://www.energy.gov/eere/solar/streamlining-solar-permitting-solarapp",
          note: "No statewide Arizona mandate; adoption is by jurisdiction (e.g. Pima County, Mesa) — confirm local status before quoting.",
          verified: "2026-07-10",
        },
      ],
      consumer: [
        {
          name: "Arizona Corporation Commission — Consumer Services",
          url: "https://azcc.gov/utilities/consumer-services",
          note: "Covers billing/service complaints against regulated utilities. ACC staff can't assist with complaints about solar companies themselves — route contractor disputes to the Registrar of Contractors instead.",
          verified: "2026-07-10",
        },
        {
          name: "Search: Arizona Registrar of Contractors license lookup",
          url: googleSearchUrl("Arizona Registrar of Contractors license search roc.az.gov"),
          note: "Licensing board for solar contractors (CR-11 residential / C-11 commercial). roc.az.gov's own search tool is Cloudflare-gated and intermittently blocks automated checks, so linking a search instead of a direct URL — confirm a license there before signing.",
          verified: "2026-07-10",
        },
      ],
    },
  },
  CO: {
    funFact:
      "Colorado's ban on HOA covenants that prohibit solar traces back to a solar-access law originally enacted in 1979 — one of the oldest such protections in the country.",
    categories: {
      netMetering: [
        {
          name: "DSIRE — Net Metering (Colorado)",
          url: "https://programs.dsireusa.org/system/program/detail/271/net-metering",
          note: "Full retail-rate net metering for investor-owned-utility customers up to 200% of average annual consumption; smaller caps apply for municipal/co-op customers.",
          verified: "2026-07-10",
        },
        {
          name: "Colorado PUC — Electric Rules (interconnection standards)",
          url: "https://puc.colorado.gov/electricrules",
          note: "Interconnection procedures and standards live in 4 CCR 723-3, §§3850-3859.",
          verified: "2026-07-10",
        },
      ],
      hoaSolarAccess: [
        {
          name: "DSIRE — Colorado Solar/Wind Easements and Rights Law",
          url: "https://programs.dsireusa.org/system/program/detail/259/colorado-solar-wind-easements-and-rights-law",
          note: "Summarizes both governing statutes: CRS §38-30-168 (general real property) and CRS §38-33.3-106.7 (common-interest-community/HOA-specific, effective 2008).",
          verified: "2026-07-10",
        },
      ],
      incentives: [
        {
          name: "DSIRE — Sales and Use Tax Exemption for Renewable Energy Equipment (Colorado)",
          url: "https://programs.dsireusa.org/system/program/detail/3397",
          note: "Statewide 100% sales/use tax exemption for residential solar equipment.",
          verified: "2026-07-10",
        },
        {
          name: "DSIRE — Property Tax Exemption for Residential Renewable Energy Equipment (Colorado)",
          url: "https://programs.dsireusa.org/system/program/detail/4210/property-tax-exemption-for-residential-renewable-energy-equipment",
          verified: "2026-07-10",
        },
      ],
      permitting: [
        {
          name: "Colorado Energy Office — Automated Permit Processing for Solar (APPS)",
          url: "https://energyoffice.colorado.gov/apps",
          note: "State grant program funding SolarAPP+ adoption by local jurisdictions — coverage varies by city/county, confirm before quoting.",
          verified: "2026-07-10",
        },
        {
          name: "Colorado DORA — Check a Business or Professional License",
          url: "https://dora.colorado.gov/check-a-license",
          note: "Colorado has no single statewide \"solar contractor\" license; electricians are licensed via DORA, general contracting typically at the municipal level.",
          verified: "2026-07-10",
        },
      ],
      consumer: [
        {
          name: "Colorado DORA — Consumer Protection (Utilities)",
          url: "https://dora.colorado.gov/consumer-protection-utilities",
          verified: "2026-07-10",
        },
        {
          name: "Colorado PUC — Contact the PUC",
          url: "https://puc.colorado.gov/about-the-puc/contact-the-puc",
          note: "Utility complaint/comment intake — consumer assistance line and contact channels.",
          verified: "2026-07-10",
        },
      ],
    },
  },
  FL: {
    funFact:
      "Florida's solar-rights statute (F.S. § 163.04), enacted in 1980, blocks both local ordinances and HOA deed restrictions from banning solar collectors, and awards attorney's fees to whichever side wins a dispute over it.",
    categories: {
      netMetering: [
        {
          name: "DSIRE — Net Metering (Florida)",
          url: "https://programs.dsireusa.org/system/program/detail/2880/net-metering",
          note: "Full retail-rate net metering for systems up to 2 MW, adopted by the Florida PSC; excess generation reconciled annually at avoided-cost rate.",
          verified: "2026-07-10",
        },
        {
          name: "DSIRE — Interconnection Standards (Florida)",
          url: "https://programs.dsireusa.org/system/program/detail/2882/interconnection-standards",
          verified: "2026-07-10",
        },
      ],
      hoaSolarAccess: [
        {
          name: "Florida Statutes § 163.04 — Energy devices based on renewable resources",
          url: "https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0100-0199%2F0163%2FSections%2F0163.04.html",
          note: "Voids deed restrictions/covenants that prohibit solar collectors; an approving entity may only dictate roof orientation within 45° of due south if it doesn't impair performance.",
          verified: "2026-07-10",
        },
      ],
      incentives: [
        {
          name: "DSIRE — Solar and CHP Sales Tax Exemption (Florida)",
          url: "https://programs.dsireusa.org/system/program/detail/243/solar-and-chp-sales-tax-exemption",
          verified: "2026-07-10",
        },
        {
          name: "DSIRE — Property Tax Abatement for Renewable Energy Property (Florida)",
          url: "https://programs.dsireusa.org/system/program/detail/5426/property-tax-abatement-for-renewable-energy-property",
          verified: "2026-07-10",
        },
      ],
      permitting: [
        {
          name: "Florida HB 683 (2025) — Construction Regulations",
          url: "https://www.flsenate.gov/Session/Bill/2025/683",
          note: "Effective 7/1/2025: requires local governments to approve single-trade residential solar permits within 5 business days (or automatic approval), and authorizes automated plan-review software like SolarAPP+. County-level timelines still vary.",
          verified: "2026-07-10",
        },
        {
          name: "DBPR — Verify a License (Florida contractor lookup)",
          url: "https://www2.myfloridalicense.com/online-services/verify-license/",
          note: "Solar contractors need a DBPR-issued Certified Solar Contractor license.",
          verified: "2026-07-10",
        },
      ],
      consumer: [
        {
          name: "Florida Public Service Commission — Consumer Complaint Form",
          url: "https://www.floridapsc.com/consumer-complaint-form",
          note: "Covers billing/service/outage complaints against PSC-regulated utilities — not solar-installer contract disputes; use the DBPR channel for those.",
          verified: "2026-07-10",
        },
      ],
    },
  },
  NV: {
    funFact:
      "Nevada's net metering rate is a step-down structure created by Assembly Bill 405 (2017): the earliest post-reform customers locked in 95% of retail rate for 20 years, while the current tier for systems up to 25 kW pays 75%.",
    categories: {
      netMetering: [
        {
          name: "DSIRE — Net Metering / Net Billing (Nevada)",
          url: "https://programs.dsireusa.org/system/program/detail/372/net-metering-net-billing",
          note: "Current tier (systems ≤25 kW): net excess generation credited at 75% of retail rate for both Nevada Power and Sierra Pacific Power; 25 kW–1 MW netted at full retail rate.",
          verified: "2026-07-10",
        },
        {
          name: "PUCN — Net Metering in Nevada",
          url: "https://puc.nv.gov/renewables/net-metering-in-nevada/",
          note: "Explains the AB 405 (2017) tiered rate structure and the capacity benchmarks that trigger each step-down.",
          verified: "2026-07-10",
        },
      ],
      hoaSolarAccess: [
        {
          name: "Nevada Revised Statutes § 111.239 — Restriction on solar energy systems",
          url: "https://www.leg.state.nv.us/NRS/NRS-111.html",
          note: "Any deed/covenant/HOA restriction that prohibits or unreasonably restricts a solar system is void and unenforceable. Companion statute NRS 278.0208 applies the same rule to local-government ordinances.",
          verified: "2026-07-10",
        },
      ],
      incentives: [
        {
          name: "DSIRE — Renewable Energy Sales and Use Tax Abatement (Nevada)",
          url: "https://programs.dsireusa.org/system/program/detail/3233/renewable-energy-sales-and-use-tax-abatement",
          verified: "2026-07-10",
        },
        {
          name: "DSIRE — Renewable Energy Systems Property Tax Exemption (Nevada)",
          url: "https://programs.dsireusa.org/system/program/detail/158/renewable-energy-systems-property-tax-exemption",
          verified: "2026-07-10",
        },
      ],
      permitting: [
        {
          name: "DSIRE — Solar Contractor Licensing (Nevada)",
          url: "https://programs.dsireusa.org/system/program/detail/386/solar-contractor-licensing",
          verified: "2026-07-10",
        },
        {
          name: "DSIRE — Interconnection Standards (Nevada)",
          url: "https://programs.dsireusa.org/system/program/detail/791/interconnection-standards",
          verified: "2026-07-10",
        },
      ],
      consumer: [
        {
          name: "PUCN — Consumer Complaints with a Utility",
          url: "https://puc.nv.gov/FAQ/Resolving_Disputes/",
          note: "Informal complaints via PUCN's Consumer Complaint Resolution Division, typically resolved in 3-5 business days.",
          verified: "2026-07-10",
        },
        {
          name: "Nevada State Contractors Board",
          url: "https://www.nvcontractorsboard.com/",
          note: "Solar work needs specific classification endorsements (e.g. C-2 Solar/PV).",
          verified: "2026-07-10",
        },
      ],
    },
  },
  NC: {
    funFact:
      "North Carolina's solar deed-restriction law (G.S. § 22B-20) voids HOA covenants that ban solar collectors outright — but carves out an exception letting associations still prohibit panels visible on a street-facing façade or roof slope.",
    categories: {
      netMetering: [
        {
          name: "NC Public Staff — Net Metering (Rider RSC / Rider NMB)",
          url: "https://publicstaff.nc.gov/electric/net-metering",
          note: "The consumer-protection arm operating under the NC Utilities Commission summarizes the revised net-metering riders effective 10/1/2023; legacy customers transition to Rider NMB by 1/1/2027.",
          verified: "2026-07-10",
        },
        {
          name: "DSIRE — Net Metering (North Carolina)",
          url: "https://programs.dsireusa.org/system/program/detail/1246/net-metering",
          verified: "2026-07-10",
        },
      ],
      hoaSolarAccess: [
        {
          name: "N.C. Gen. Stat. § 22B-20 — Deed restrictions prohibiting solar collectors",
          url: "https://www.ncleg.gov/EnactedLegislation/Statutes/PDF/BySection/Chapter_22B/GS_22B-20.pdf",
          note: "Voids deed restrictions/covenants that prohibit solar collectors on residential property, except (d)(1)-(3) permits HOAs to still ban placement visible on the street-facing façade/roof slope. Does not apply to multi-story condos under Ch. 47A/47C.",
          funFact: "The statute explicitly excludes multi-story condominium buildings — it only reaches single-family and townhouse-style residential property.",
          verified: "2026-07-10",
        },
      ],
      incentives: [
        {
          name: "DSIRE — Property Tax Abatement for Solar Electric Systems (North Carolina)",
          url: "https://programs.dsireusa.org/system/program/detail/3036/property-tax-abatement-for-solar-electric-systems",
          note: "80% property-tax exclusion for solar electric systems (residential systems are effectively fully excluded; commercial gets the 80% abatement).",
          verified: "2026-07-10",
        },
      ],
      permitting: [
        {
          name: "DSIRE — Interconnection Standards (North Carolina)",
          url: "https://programs.dsireusa.org/system/program/detail/354/interconnection-standards",
          verified: "2026-07-10",
        },
        {
          name: "NC Licensing Board for General Contractors — License Search",
          url: "https://portal.nclbgc.org/Public/Search",
          note: "Electrical/solar installers above certain project values fall under separate electrical-contractor licensing (NCGS 87-43), not this board.",
          verified: "2026-07-10",
        },
      ],
      consumer: [
        {
          name: "NC Utilities Commission — Formal Complaint Process",
          url: "https://www.ncuc.gov/Consumer/complaint.html",
          note: "Contact Public Staff's Consumer Services Division first before filing a formal complaint.",
          verified: "2026-07-10",
        },
      ],
    },
  },
  NJ: {
    funFact:
      "New Jersey retired its SREC program entirely in 2021 and replaced it with the Successor Solar Incentive (SuSI) Program, split into a fixed-rate track and a competitive-bid track for larger projects.",
    categories: {
      netMetering: [
        {
          name: "DSIRE — Net Metering (New Jersey)",
          url: "https://programs.dsireusa.org/system/program/detail/38/net-metering",
          note: "Administered by the NJ Board of Public Utilities (NJBPU).",
          verified: "2026-07-10",
        },
      ],
      hoaSolarAccess: [
        {
          name: "DSIRE — New Jersey Solar Easement and Access Laws",
          url: "https://programs.dsireusa.org/system/program/detail/2722/new-jersey-solar-easement-and-access-laws",
          note: "Secondary sources cite the underlying statute as N.J.S.A. 45:22A-48.2, but a stable official njleg.gov citation link could not be confirmed — use this DSIRE summary and confirm current statute text before citing specifics.",
          verified: "2026-07-10",
        },
      ],
      incentives: [
        {
          name: "DSIRE — Successor Solar Incentive (SuSI) Program",
          url: "https://programs.dsireusa.org/system/program/detail/22418/successor-solar-incentive-susi-program-administratively-determined-incentive",
          note: "Fixed-rate incentive track for net-metered systems ≤5 MW and community solar.",
          verified: "2026-07-10",
        },
        {
          name: "DSIRE — Solar Energy Sales Tax Exemption (New Jersey)",
          url: "https://programs.dsireusa.org/system/program/detail/219/solar-energy-sales-tax-exemption",
          verified: "2026-07-10",
        },
      ],
      permitting: [
        {
          name: "DSIRE — Interconnection Standards (New Jersey)",
          url: "https://programs.dsireusa.org/system/program/detail/797/interconnection-standards",
          note: "NJBPU has an active rulemaking on a standardized interconnection dispute-resolution process.",
          verified: "2026-07-10",
        },
        {
          name: "NJ Division of Consumer Affairs — Verify a Home Improvement Contractor",
          url: "https://www.njconsumeraffairs.gov/hic/Pages/verification.aspx",
          note: "NJ requires Home Improvement Contractor registration for contracts over $500.",
          verified: "2026-07-10",
        },
      ],
      consumer: [
        {
          name: "NJ Board of Public Utilities — File a Complaint",
          url: "https://www.nj.gov/bpu/assistance/complaints/inquiry.html",
          note: "Contact your utility first before filing with NJBPU's Division of Customer Assistance.",
          verified: "2026-07-10",
        },
      ],
    },
  },
  NY: {
    funFact:
      "New York's solar-rights statute (Real Property Law § 342) lets HOAs still ban solar on commonly-owned property, but voids any rule that would \"effectively prohibit\" a system on a member's own property or raise its cost by more than 10%.",
    categories: {
      netMetering: [
        {
          name: "DSIRE — Net Metering (New York)",
          url: "https://programs.dsireusa.org/system/program/detail/453/net-metering",
          verified: "2026-07-10",
        },
        {
          name: "NY DPS — Distributed Generation Information",
          url: "https://dps.ny.gov/distributed-generation-information",
          note: "Official Dept. of Public Service hub for the Standardized Interconnection Requirements and VDER technical resources.",
          verified: "2026-07-10",
        },
      ],
      hoaSolarAccess: [
        {
          name: "DSIRE — New York Solar Easements & Solar Rights Laws",
          url: "https://programs.dsireusa.org/system/program/detail/309/new-york-solar-easements-solar-rights-laws",
          note: "Summarizes NY Real Property Law § 342, which voids HOA rules that \"effectively prohibit or impose unreasonable limitations\" on residential solar (HOAs may still restrict installations on commonly-owned property). The official nysenate.gov statute page was intermittently unreachable during verification, so linking DSIRE's summary instead — cross-check the current statute text there before citing specifics.",
          verified: "2026-07-10",
        },
      ],
      incentives: [
        {
          name: "NYSERDA — NY-Sun Solar Program",
          url: "https://www.nyserda.ny.gov/All-Programs/NY-Sun",
          note: "On-site solar incentives and community solar, statewide.",
          verified: "2026-07-10",
        },
        {
          name: "DSIRE — Solar Sales Tax Exemption (New York)",
          url: "https://programs.dsireusa.org/system/program/detail/1234/solar-sales-tax-exemption",
          verified: "2026-07-10",
        },
      ],
      permitting: [
        {
          name: "NY DPS — Standardized Interconnection Requirements",
          url: "https://dps.ny.gov/distributed-generation-information",
          note: "PSC's framework for interconnecting distributed generation ≤5 MW.",
          verified: "2026-07-10",
        },
      ],
      consumer: [
        {
          name: "NY Department of Public Service — File a Complaint",
          url: "https://dps.ny.gov/file-complaint",
          verified: "2026-07-10",
        },
        {
          name: "NYC DCWP — Check a Home Improvement Contractor License",
          url: "https://www.nyc.gov/site/dca/consumers/check-license.page",
          note: "New York has no single statewide contractor license — licensing is county/city-run. This NYC tool is the largest single lookup, shown as a representative example rather than a statewide registry.",
          verified: "2026-07-10",
        },
      ],
    },
  },
  MA: {
    funFact:
      "Massachusetts law (G.L. c.184 § 23C) makes any deed restriction that \"forbids or unreasonably restricts\" a solar energy system void outright.",
    categories: {
      netMetering: [
        {
          name: "DSIRE — Net Metering (Massachusetts)",
          url: "https://programs.dsireusa.org/system/program/detail/281/net-metering",
          verified: "2026-07-10",
        },
      ],
      hoaSolarAccess: [
        {
          name: "Mass. General Laws c.184, § 23C — Solar energy systems; restrictive provisions",
          url: "https://malegislature.gov/Laws/GeneralLaws/PartII/TitleI/Chapter184/Section23C",
          note: "Any deed/instrument provision that \"purports to forbid or unreasonably restrict the installation or use of a solar energy system\" is void.",
          verified: "2026-07-10",
        },
      ],
      incentives: [
        {
          name: "DSIRE — Solar Massachusetts Renewable Target (SMART) Program",
          url: "https://programs.dsireusa.org/system/program/detail/22111/solar-massachusetts-renewable-target-smart-program",
          note: "MA's current performance-based solar incentive (successor to SRECs), administered by the investor-owned utilities under DOER/DPU oversight.",
          verified: "2026-07-10",
        },
        {
          name: "DSIRE — Renewable Energy Equipment Sales Tax Exemption (Massachusetts)",
          url: "https://programs.dsireusa.org/system/program/detail/145/renewable-energy-equipment-sales-tax-exemption",
          verified: "2026-07-10",
        },
      ],
      permitting: [
        {
          name: "Mass. General Laws c.40A, § 3 — Solar access (zoning)",
          url: "https://malegislature.gov/Laws/GeneralLaws/PartI/TitleVII/Chapter40a/Section3",
          note: "\"No zoning ordinance or by-law shall prohibit or unreasonably regulate the installation of solar energy systems... except where necessary to protect the public health, safety or welfare.\"",
          verified: "2026-07-10",
        },
        {
          name: "DSIRE — Interconnection Standards (Massachusetts)",
          url: "https://programs.dsireusa.org/system/program/detail/986/interconnection-standards",
          verified: "2026-07-10",
        },
      ],
      consumer: [
        {
          name: "Mass. DPU Consumer Division — File a Complaint",
          url: "https://www.mass.gov/how-to/file-a-complaint-involving-a-gas-electric-or-water-company",
          verified: "2026-07-10",
        },
        {
          name: "Mass.gov — Check a Home Improvement Contractor Registration",
          url: "https://www.mass.gov/how-to/check-a-home-improvement-contractor-registration",
          verified: "2026-07-10",
        },
      ],
    },
  },
};

export function fallbackFor(stateCode) {
  const name = STATE_NAMES[stateCode] || stateCode;
  const dsireUrl = `https://programs.dsireusa.org/system/program?state=${stateCode}`;
  const pucSearchUrl = googleSearchUrl(`${name} public utilities commission solar complaint`);

  return {
    funFact: null,
    categories: {
      netMetering: [
        {
          name: `DSIRE — ${name} net metering & interconnection rules`,
          url: dsireUrl,
          note: `Filter by "Net Metering" or "Interconnection" program type for ${name}'s current export rules.`,
          verified: "2026-07-10",
        },
      ],
      hoaSolarAccess: [
        {
          name: `DSIRE — ${name} regulatory policies`,
          url: dsireUrl,
          note: `DSIRE doesn't consistently index HOA statutes by name — filter by "Regulatory Policy" or search ${name}'s official statutes site for "solar access" / "solar rights."`,
          verified: "2026-07-10",
        },
      ],
      incentives: [
        {
          name: `DSIRE — ${name} incentives & tax exemptions`,
          url: dsireUrl,
          note: `Full, self-updating list of every ${name} state and utility incentive, rebate, and tax exemption.`,
          verified: "2026-07-10",
        },
      ],
      permitting: [
        {
          name: `DSIRE — ${name} permitting & interconnection standards`,
          url: dsireUrl,
          note: `Filter by "Interconnection," or check your local building department for permitting specifics.`,
          verified: "2026-07-10",
        },
      ],
      consumer: [
        {
          name: "FTC — Solar Power for Your Home",
          url: "https://consumer.ftc.gov/articles/solar-power-your-home",
          note: "Federal consumer-protection guidance on solar contracts, financing, and avoiding sales scams — national, applies in every state.",
          verified: "2026-07-11",
        },
        {
          name: `Search: ${name} PUC complaint process`,
          url: pucSearchUrl,
          note: "Find your state utility commission's consumer complaint page.",
          verified: "2026-07-10",
        },
      ],
    },
  };
}
