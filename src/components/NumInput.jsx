import useNumberDraft from "../hooks/useNumberDraft.js";

export default function NumInput({ prefix, value, min, max, step, onChange, decimals = 0 }) {
  // Draft-until-blur — see hooks/useNumberDraft.js. No emptyValue: clearing
  // reverts to the previous value, which is the existing behavior here.
  const { displayValue, handlers } = useNumberDraft(value, onChange, { min, max });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
      <span className="mono" style={{ color: "#F5B62E", fontSize: 15 }}>{prefix}</span>
      <input type="number" className="mono"
        value={displayValue(decimals ? value.toFixed(decimals) : value)}
        min={min} max={max} step={step}
        {...handlers}
        style={{ background: "#0B1626", color: "#EAF0F7", border: "1px solid #22385A", borderRadius: 8, padding: "8px 12px", fontSize: 16, width: 110 }} />
    </div>
  );
}
