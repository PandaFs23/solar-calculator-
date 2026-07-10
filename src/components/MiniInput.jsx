import { useState } from "react";

export default function MiniInput({ label, value, min, max, step, onChange }) {
  const [draft, setDraft] = useState(null);
  const commit = (raw) => {
    const v = parseFloat(raw);
    if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
    setDraft(null);
  };
  return (
    <div>
      <div className="mono" style={{ fontSize: 10.5, color: "#8FA3BC", marginBottom: 3 }}>{label}</div>
      <input type="number" className="mono"
        value={draft !== null ? draft : value}
        min={min} max={max} step={step}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(e.currentTarget.value); }}
        style={{ background: "#0B1626", color: "#EAF0F7", border: "1px solid #22385A", borderRadius: 6, padding: "5px 8px", fontSize: 13, width: 78 }} />
    </div>
  );
}
