export default function Section({ on, setOn, color, fill, icon, title, children }) {
  return (
    <div style={{ margin: "0 -24px 22px", padding: "18px 24px", background: on ? fill : "transparent", borderTop: "1px solid #22385A", borderBottom: "1px solid #22385A", transition: "background .25s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {icon}
          <span style={{ fontSize: 13.5, fontWeight: 500 }}>{title}</span>
        </div>
        <button onClick={() => setOn(!on)} aria-pressed={on}
          style={{ width: 46, height: 26, borderRadius: 13, cursor: "pointer", position: "relative", background: on ? color : "#22385A", border: "none", transition: "background .2s" }}>
          <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#EAF0F7", transition: "left .2s" }} />
        </button>
      </div>
      {on && <div style={{ marginTop: 18 }}>{children}</div>}
    </div>
  );
}
