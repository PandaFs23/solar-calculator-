import { useState } from "react";
import { Sun } from "lucide-react";
import { C } from "./data/constants.js";
import ResidentialCalculator from "./modules/ResidentialCalculator.jsx";
import CommercialCalculator from "./modules/CommercialCalculator.jsx";

// Segmented pill control — must be discoverable before any data entry (mode
// changes which calculator you're filling out), always visible, and separate
// from the calculator's input flow so commercial reads as its own product
// surface. Gold-on-active styling matches the existing Toggle language.
function ModeSwitch({ mode, setMode }) {
  return (
    <div role="tablist" aria-label="Calculator mode"
      style={{ display: "flex", gap: 3, padding: 3, border: `1px solid ${C.line}`, borderRadius: 999, background: C.slate }}>
      {[["residential", "Residential"], ["commercial", "Commercial"]].map(([m, label]) => (
        <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
          style={{
            padding: "7px 18px", fontSize: 13, fontFamily: "inherit", fontWeight: 600, cursor: "pointer",
            background: mode === m ? C.goldSoft : "transparent",
            color: mode === m ? C.gold : C.dim,
            border: `1px solid ${mode === m ? C.gold : "transparent"}`,
            borderRadius: 999, transition: "color .15s, background .15s, border-color .15s",
          }}>
          {label}
        </button>
      ))}
    </div>
  );
}

export default function App() {
  const [appMode, setAppMode] = useState("residential");

  return (
    <div className="app-root" style={{ minHeight: "100vh", background: C.night, color: C.text, fontFamily: "'Space Grotesk', 'Segoe UI', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
        input[type=range] { -webkit-appearance: none; width: 100%; height: 4px; border-radius: 2px; background: ${C.line}; outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: ${C.gold}; cursor: pointer; border: 3px solid ${C.night}; box-shadow: 0 0 0 2px ${C.gold}; }
        input[type=range]::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: ${C.gold}; cursor: pointer; border: 3px solid ${C.night}; box-shadow: 0 0 0 2px ${C.gold}; }
        input[type=number] { -moz-appearance: textfield; }
        input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; }
        .mono { font-family: 'IBM Plex Mono', monospace; }
        @keyframes cellIn { from { opacity: 0; transform: scale(.7); } to { opacity: 1; transform: scale(1); } }
        .cell { animation: cellIn .25s ease both; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .cell, .spin { animation: none; } }
        button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid ${C.gold}; outline-offset: 2px; }
        .print-report { display: none; }
        @media print {
          @page { margin: 12mm; }
          .app-root { background: #fff !important; min-height: 0 !important; }
          .app-screen { display: none !important; }
          .print-report { display: block !important; color: #111; font-family: Georgia, 'Times New Roman', serif; }
          .print-report .mono { font-family: 'Courier New', monospace; }
        }
      `}</style>

      {/* header: kicker + mode switch on one row; the pill wraps below on narrow widths */}
      <div className="app-screen" style={{ maxWidth: 1040, margin: "0 auto", padding: "40px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
          <Sun size={26} color={C.gold} />
          <span className="mono" style={{ fontSize: 12, letterSpacing: 3, color: C.gold }}>SOLAR SIZING WORKSHEET</span>
          <div style={{ marginLeft: "auto" }}>
            <ModeSwitch mode={appMode} setMode={setAppMode} />
          </div>
        </div>
      </div>

      {/* both modules stay mounted so each keeps its state across switches;
          display:none also removes the inactive module's print template */}
      <div style={{ display: appMode === "residential" ? "block" : "none" }}>
        <ResidentialCalculator />
      </div>
      <div style={{ display: appMode === "commercial" ? "block" : "none" }}>
        <CommercialCalculator />
      </div>
    </div>
  );
}
