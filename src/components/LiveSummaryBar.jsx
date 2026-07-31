import { C } from "../data/constants.js";

// Slim always-live readout that takes over once the main results panel
// scrolls out of view.
//
// WHY THIS EXISTS: the results panel is position:sticky inside the two-column
// row, so it tracks the inputs card perfectly — but a sticky element cannot
// escape its containing block, and System Configuration + Household Loads sit
// BELOW that row as full-width cards. Those change the numbers too, so without
// this the panel would vanish exactly when a rep starts toggling appliances.
//
// Moving those cards into the narrow column would have fixed the containing
// block, but the loads table is full-width on purpose. This keeps the layout
// and still guarantees the live figures are on screen for the whole page.
export default function LiveSummaryBar({ visible, items }) {
  return (
    <div
      aria-hidden={!visible}
      className="live-summary-bar"
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 60,
        background: `${C.slate}f2`, borderBottom: `1px solid ${C.line}`,
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        boxShadow: visible ? "0 4px 18px rgba(0,0,0,.35)" : "none",
        transform: visible ? "translateY(0)" : "translateY(-100%)",
        opacity: visible ? 1 : 0,
        transition: "transform .2s ease, opacity .2s ease",
        pointerEvents: visible ? "auto" : "none",
      }}>
      <div style={{
        maxWidth: 1040, margin: "0 auto", padding: "9px 20px",
        display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap",
      }}>
        <span className="mono" style={{ fontSize: 10.5, letterSpacing: 2, color: C.gold, whiteSpace: "nowrap" }}>
          YOUR SYSTEM
        </span>
        {items.map((it) => (
          <span key={it.label} style={{ display: "flex", alignItems: "baseline", gap: 6, whiteSpace: "nowrap" }}>
            <span className="mono" style={{ fontSize: 10.5, color: C.dim, letterSpacing: 1 }}>{it.label}</span>
            <span className="mono" style={{ fontSize: 14, fontWeight: 500, color: it.color || C.text }}>{it.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
