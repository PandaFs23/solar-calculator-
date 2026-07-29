import { C, MONTHS } from "../data/constants.js";
import UsageSparkline from "./UsageSparkline.jsx";

// 12-input grid for measured monthly kWh consumption. Values feed sizing
// and monthly savings when populated; leaving all zeros preserves the
// existing bill/annualKwh input pathway (an "off" state).
export default function MonthlyUsageGrid({ values, onChange, onFillEven, onClear }) {
  const total = values.reduce((s, v) => s + (Number(v) || 0), 0);
  const avg = total / 12;
  const anomalyCount = values.filter((v) => avg > 0 && Math.abs((Number(v) || 0) - avg) / avg > 0.3).length;

  const setAt = (i, raw) => {
    const v = raw === "" ? 0 : Math.max(0, Math.round(Number(raw) || 0));
    const next = values.slice();
    next[i] = v;
    onChange(next);
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, marginBottom: 10 }}>
        {MONTHS.map((m, i) => (
          <label key={m} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span className="mono" style={{ fontSize: 10, color: C.dim, letterSpacing: 1 }}>{m.toUpperCase()}</span>
            <input type="number" inputMode="numeric" min={0}
              value={values[i] || ""} onChange={(e) => setAt(i, e.target.value)}
              placeholder="0"
              style={{
                background: C.night, color: C.text,
                border: `1px solid ${C.line}`, borderRadius: 6,
                padding: "6px 8px", fontSize: 13, fontFamily: "'IBM Plex Mono', monospace",
                width: "100%", minWidth: 0, boxSizing: "border-box",
              }} />
          </label>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <button onClick={onFillEven}
          style={{ background: "transparent", border: `1px solid ${C.gold}66`, color: C.gold,
            borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
          Fill evenly from annual total
        </button>
        {total > 0 && (
          <button onClick={onClear}
            style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.dim,
              borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            Clear all
          </button>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <UsageSparkline values={values} />
        <div className="mono" style={{ fontSize: 12, color: C.dim, lineHeight: 1.7 }}>
          Total: <span style={{ color: C.gold }}>{total.toLocaleString()}</span> kWh/yr<br />
          Average: {Math.round(avg).toLocaleString()} kWh/mo
          {anomalyCount > 0 && (
            <><br /><span style={{ color: C.copper }}>{anomalyCount} month{anomalyCount > 1 ? "s" : ""} &gt; 30% from average</span></>
          )}
        </div>
      </div>
    </div>
  );
}
