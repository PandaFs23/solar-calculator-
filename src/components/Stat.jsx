export default function Stat({ icon, label, value, sub, accent }) {
  return (
    <div style={{ background: "#13233A", border: "1px solid #22385A", borderRadius: 14, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {icon}
        <span className="mono" style={{ fontSize: 11, letterSpacing: 1.5, color: "#8FA3BC", textTransform: "uppercase" }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent || "#EAF0F7" }}>{value}</div>
      <div style={{ fontSize: 12.5, color: "#8FA3BC", marginTop: 4 }}>{sub}</div>
    </div>
  );
}
