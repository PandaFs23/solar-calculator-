// Dismissible hint shown under the aerial view when OSM tags the located
// property as the other mode's type. Deliberately soft language: OSM building
// tags are community-sourced and often missing or stale — this is a hint, not
// a verdict, and the header mode toggle always wins.
export default function ModeSuggestionBanner({ osmLabel, targetMode, onSwitch, onDismiss }) {
  const targetName = targetMode === "commercial" ? "Commercial" : "Residential";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 10,
      padding: "10px 12px", borderRadius: 8, background: "#F5B62E14", border: "1px solid #F5B62E66",
    }}>
      <span style={{ fontSize: 12.5, color: "#EAF0F7", lineHeight: 1.5, flex: "1 1 240px" }}>
        OpenStreetMap tags this property as <b style={{ color: "#F5B62E" }}>{targetMode}{osmLabel ? ` (${osmLabel})` : ""}</b> — switch to {targetName} mode?
        <span className="mono" style={{ display: "block", fontSize: 10.5, color: "#8FA3BC", marginTop: 3 }}>
          Community-sourced tag — may be missing or wrong. Your mode choice always wins.
        </span>
      </span>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={onSwitch}
          style={{
            padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
            fontSize: 12.5, fontWeight: 600, background: "#F5B62E22", border: "1px solid #F5B62E", color: "#F5B62E",
          }}>
          Switch to {targetName}
        </button>
        <button onClick={onDismiss} aria-label="Dismiss suggestion" title="Dismiss"
          style={{
            padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
            fontSize: 13, background: "transparent", border: "1px solid #22385A", color: "#8FA3BC",
          }}>
          ✕
        </button>
      </div>
    </div>
  );
}
