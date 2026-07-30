import { C, MONTHS } from "../data/constants.js";
import UsageSparkline from "./UsageSparkline.jsx";
import useNumberDraft from "../hooks/useNumberDraft.js";

// 12-input grid for measured monthly kWh, read straight off the bill's usage
// history. When any value is > 0 the sum becomes the annual usage and overrides
// the single annual/bill figure; all zeros preserves the existing pathway.
//
// Pairs with the NASA POWER irradiance basis: that gives monthly PRODUCTION,
// this gives monthly USAGE, so the chart can show a true month-by-month offset
// instead of a flat annual average smeared across a seasonal curve.
//
// Cells use the shared draft-until-blur hook, so backspacing through a value
// does not snap it to 0 mid-edit. Clearing a cell commits 0 (emptyValue), which
// for a usage grid is the honest meaning of "cleared".
function MonthCell({ month, value, onChange }) {
  const { displayValue, handlers } = useNumberDraft(value, onChange, {
    min: 0, integer: true, emptyValue: 0,
  });
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
      <span className="mono" style={{ fontSize: 10, color: C.dim, letterSpacing: 1 }}>
        {month.toUpperCase()}
      </span>
      <input type="number" inputMode="numeric" min={0} placeholder="0"
        value={displayValue(value || "")}
        {...handlers}
        style={{
          background: C.night, color: C.text,
          border: `1px solid ${C.line}`, borderRadius: 6,
          padding: "6px 8px", fontSize: 13, fontFamily: "'IBM Plex Mono', monospace",
          width: "100%", minWidth: 0, boxSizing: "border-box",
        }} />
    </label>
  );
}

export default function MonthlyUsageGrid({ values, onChange, onFillEven, onClear, annualFallback }) {
  const total = values.reduce((s, v) => s + (Number(v) || 0), 0);
  const active = total > 0;
  const filled = values.filter((v) => Number(v) > 0).length;
  const avg = active ? total / 12 : 0;
  const anomalyCount = values.filter((v) => avg > 0 && Math.abs((Number(v) || 0) - avg) / avg > 0.3).length;

  const setAt = (i, v) => {
    const next = values.slice();
    next[i] = v;
    onChange(next);
  };

  return (
    <div>
      {/* 12 across on wide screens, wrapping down gracefully on narrow ones */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(62px, 1fr))",
        gap: 6, marginBottom: 10,
      }}>
        {MONTHS.map((m, i) => (
          <MonthCell key={m} month={m} value={values[i]} onChange={(v) => setAt(i, v)} />
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <button onClick={onFillEven}
          style={{ background: "transparent", border: `1px solid ${C.gold}66`, color: C.gold,
            borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
          Fill evenly from annual total
        </button>
        {active && (
          <button onClick={onClear}
            style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.dim,
              borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            Clear all
          </button>
        )}
      </div>

      {/* read-only annual sum, so the rep can sanity-check against the bill */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        padding: "8px 11px", marginBottom: 10, borderRadius: 8,
        background: active ? C.greenSoft : "transparent",
        border: `1px solid ${active ? `${C.green}55` : C.line}`,
      }}>
        <span className="mono" style={{ fontSize: 11, color: C.dim, letterSpacing: 1 }}>ANNUAL SUM</span>
        <span className="mono" style={{ fontSize: 15, color: active ? C.green : C.dim }}>
          {total.toLocaleString()} <span style={{ fontSize: 11 }}>kWh/yr</span>
        </span>
        <span className="mono" style={{ fontSize: 11, color: C.dim }}>
          {active
            ? `overriding the annual/bill input · ${filled}/12 months entered`
            : `not in use — annual input stands${annualFallback ? ` (${Math.round(annualFallback).toLocaleString()} kWh/yr)` : ""}`}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <UsageSparkline values={values} />
        <div className="mono" style={{ fontSize: 12, color: C.dim, lineHeight: 1.7 }}>
          Average: {Math.round(avg).toLocaleString()} kWh/mo
          {active && filled < 12 && (
            <><br /><span style={{ color: C.copper }}>
              {12 - filled} month{12 - filled > 1 ? "s" : ""} still 0 — the sum will understate the year
            </span></>
          )}
          {anomalyCount > 0 && (
            <><br /><span style={{ color: C.copper }}>{anomalyCount} month{anomalyCount > 1 ? "s" : ""} &gt; 30% from average</span></>
          )}
        </div>
      </div>
    </div>
  );
}
