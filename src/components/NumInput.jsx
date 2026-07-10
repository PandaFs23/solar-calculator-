import { useState } from "react";

export default function NumInput({ prefix, value, min, max, step, onChange, decimals = 0 }) {
  const [draft, setDraft] = useState(null);
  const commit = (raw) => {
    const v = parseFloat(raw);
    if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
    setDraft(null);
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
      <span className="mono" style={{ color: "#F5B62E", fontSize: 15 }}>{prefix}</span>
      <input type="number" className="mono"
        value={draft !== null ? draft : (decimals ? value.toFixed(decimals) : value)}
        min={min} max={max} step={step}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(e.currentTarget.value); }}
        style={{ background: "#0B1626", color: "#EAF0F7", border: "1px solid #22385A", borderRadius: 8, padding: "8px 12px", fontSize: 16, width: 110 }} />
    </div>
  );
}
