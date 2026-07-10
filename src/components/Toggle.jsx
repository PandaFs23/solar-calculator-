export default function Toggle({ active, onClick, children, color = "#F5B62E", small }) {
  return (
    <button onClick={onClick}
      style={{
        flex: small ? "none" : 1, padding: small ? "6px 12px" : "9px 0", borderRadius: 8, cursor: "pointer",
        fontSize: small ? 12.5 : 13.5, fontFamily: "inherit", fontWeight: 500,
        background: active ? `${color}22` : "transparent",
        border: `1px solid ${active ? color : "#22385A"}`,
        color: active ? color : "#8FA3BC",
      }}>
      {children}
    </button>
  );
}
