export default function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 4 }}>{label}</div>
      {hint ? <div style={{ fontSize: 12, color: "#8FA3BC", marginBottom: 8 }}>{hint}</div> : <div style={{ height: 4 }} />}
      {children}
    </div>
  );
}
