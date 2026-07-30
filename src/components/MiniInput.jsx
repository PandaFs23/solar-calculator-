import useNumberDraft from "../hooks/useNumberDraft.js";

export default function MiniInput({ label, value, min, max, step, onChange }) {
  // Draft-until-blur — see hooks/useNumberDraft.js. No emptyValue: clearing
  // reverts to the previous value, which is the existing behavior here.
  const { displayValue, handlers } = useNumberDraft(value, onChange, { min, max });
  return (
    <div>
      <div className="mono" style={{ fontSize: 10.5, color: "#8FA3BC", marginBottom: 3 }}>{label}</div>
      <input type="number" className="mono"
        value={displayValue(value)}
        min={min} max={max} step={step}
        {...handlers}
        style={{ background: "#0B1626", color: "#EAF0F7", border: "1px solid #22385A", borderRadius: 6, padding: "5px 8px", fontSize: 13, width: 78 }} />
    </div>
  );
}
