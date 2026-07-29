import { C } from "../data/constants.js";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

// Groups feasibility items into error / warning / info sections with color
// coding. Errors block a "build" state; warnings caution; info is advisory.
// Clicking a row could scroll a corresponding field into view — parent
// wires that with onSelect(field).
const CAT_LABEL = {
  sizing: "Sizing", roof: "Roof area", structural: "Structural load",
  mppt: "Inverter/MPPT", electrical: "AC electrical",
  "main-panel": "Main service panel", interconnect: "Utility interconnect",
  permit: "Permit", battery: "Battery sizing",
};

function icon(sev) {
  if (sev === "error") return <XCircle size={14} color={C.copper} />;
  if (sev === "warning") return <AlertTriangle size={14} color={C.gold} />;
  return <Info size={14} color={C.teal} />;
}

export default function FeasibilityPanel({ result, onSelect }) {
  const { items, summary } = result;
  const rowStyle = (sev) => ({
    display: "flex", gap: 10, alignItems: "flex-start",
    padding: "10px 12px", borderRadius: 8,
    background: sev === "error" ? "#3B1E1233" : sev === "warning" ? "#F5B62E1A" : C.night,
    border: `1px solid ${sev === "error" ? C.copper : sev === "warning" ? C.gold + "88" : C.line}`,
    cursor: onSelect ? "pointer" : "default",
    marginBottom: 6,
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        {summary.canBuild ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center", color: C.green, fontSize: 13, fontWeight: 600 }}>
            <CheckCircle2 size={16} /> No blockers detected
          </div>
        ) : (
          <div style={{ display: "flex", gap: 6, alignItems: "center", color: C.copper, fontSize: 13, fontWeight: 600 }}>
            <XCircle size={16} /> {summary.errors} blocker{summary.errors !== 1 ? "s" : ""} — resolve before quoting
          </div>
        )}
        <div className="mono" style={{ fontSize: 11.5, color: C.dim }}>
          {summary.warnings} warning{summary.warnings !== 1 ? "s" : ""} · {summary.infos} info
        </div>
      </div>

      {items.map((it, i) => (
        <div key={i} style={rowStyle(it.severity)}
          onClick={() => onSelect && it.field && onSelect(it.field)}>
          <div style={{ marginTop: 2 }}>{icon(it.severity)}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="mono" style={{ fontSize: 10.5, letterSpacing: 1, color: C.dim, marginBottom: 3 }}>
              {(CAT_LABEL[it.category] || it.category).toUpperCase()}
            </div>
            <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.55 }}>{it.message}</div>
          </div>
        </div>
      ))}

      <div className="mono" style={{ fontSize: 10.5, color: C.dim, marginTop: 10, lineHeight: 1.55 }}>
        Checklist is a sanity screen for common site-design mistakes, not a permit review — the AHJ has the final word. Rules using site data (roof area, service size, interconnect cap) only fire when that data is supplied.
      </div>
    </div>
  );
}
