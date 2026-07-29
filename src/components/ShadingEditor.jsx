import { C, MONTHS } from "../data/constants.js";
import { Plus, Trash2 } from "lucide-react";

// Obstacle editor + monthly shade result bar chart. Not a real map draw
// tool (that requires Mapbox or Google Maps and browser-exposed keys);
// this is a geometry-based approximation using height + distance + azimuth
// relative to the panel array, adequate for a sales conversation.
const TYPES = [
  { id: "tree", label: "Tree" },
  { id: "building", label: "Building" },
  { id: "chimney", label: "Chimney" },
  { id: "other", label: "Other" },
];

function emptyObstacle() {
  return {
    id: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now() + Math.random()),
    type: "tree",
    heightM: 8,
    distanceM: 10,
    azimuthDeg: 180, // south by default (worst-case for a northern-hemisphere array)
  };
}

function ObRow({ ob, onChange, onDelete }) {
  const set = (k, v) => onChange({ ...ob, [k]: v });
  return (
    <div style={{ display: "grid", gap: 6, gridTemplateColumns: "1fr 80px 80px 80px 30px", alignItems: "center", padding: "8px 10px", background: C.night, border: `1px solid ${C.line}`, borderRadius: 8 }}>
      <select value={ob.type} onChange={(e) => set("type", e.target.value)}
        style={{ background: C.slate, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: "5px 8px", fontSize: 12, fontFamily: "inherit", minWidth: 0 }}>
        {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>
      <NumCell label="H (m)" value={ob.heightM} min={0} max={80}
        onChange={(v) => set("heightM", v)} />
      <NumCell label="Dist (m)" value={ob.distanceM} min={0.5} max={200}
        onChange={(v) => set("distanceM", v)} />
      <NumCell label="Az (°)" value={ob.azimuthDeg} min={0} max={360}
        onChange={(v) => set("azimuthDeg", v)} />
      <button onClick={onDelete} title="Delete"
        style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.copper, borderRadius: 6, padding: 4, cursor: "pointer" }}>
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function NumCell({ label, value, min, max, onChange }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 9.5, color: C.dim }}>{label}</span>
      <input type="number" min={min} max={max} value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
        style={{ background: C.slate, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: "4px 6px", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", width: "100%", minWidth: 0, boxSizing: "border-box" }} />
    </label>
  );
}

function ShadeBars({ shadeFactor }) {
  const max = Math.max(0.02, ...shadeFactor);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 60 }}>
      {shadeFactor.map((v, i) => {
        const h = Math.max(1, (v / max) * 60);
        const color = v > 0.25 ? C.copper : v > 0.1 ? C.gold : C.green;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div style={{ width: "100%", height: h, background: color, borderRadius: 2 }} />
            <span className="mono" style={{ fontSize: 8, color: C.dim }}>{MONTHS[i][0]}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ShadingEditor({ obstacles, setObstacles, shadeFactor, hasLocation }) {
  const annualLoss = shadeFactor.reduce((s, v) => s + v, 0) / 12;
  return (
    <div>
      {!hasLocation && (
        <div className="mono" style={{ fontSize: 11.5, color: C.copper, marginBottom: 10, lineHeight: 1.7 }}>
          Locate an address first — shading depends on latitude (winter sun altitude).
        </div>
      )}

      {obstacles.length === 0 ? (
        <div className="mono" style={{ fontSize: 12, color: C.dim, marginBottom: 10, lineHeight: 1.7 }}>
          No obstacles added. Tap "Add obstacle" to model trees, neighboring buildings, or chimneys.
          Azimuth: 0=N · 90=E · 180=S · 270=W. Height is above the panel plane.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
          {obstacles.map((ob) => (
            <ObRow key={ob.id} ob={ob}
              onChange={(next) => setObstacles(obstacles.map((x) => x.id === ob.id ? next : x))}
              onDelete={() => setObstacles(obstacles.filter((x) => x.id !== ob.id))} />
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        <button onClick={() => setObstacles([...obstacles, emptyObstacle()])}
          style={{ display: "flex", alignItems: "center", gap: 6, background: C.goldSoft, border: `1px solid ${C.gold}`, color: C.gold, borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
          <Plus size={12} /> Add obstacle
        </button>
        {obstacles.length > 0 && (
          <button onClick={() => setObstacles([])}
            style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.dim, borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            Clear all
          </button>
        )}
      </div>

      {obstacles.length > 0 && hasLocation && (
        <div>
          <ShadeBars shadeFactor={shadeFactor} />
          <div className="mono" style={{ fontSize: 11.5, color: C.dim, marginTop: 8, lineHeight: 1.7 }}>
            Annual shade loss estimate: <span style={{ color: annualLoss > 0.15 ? C.copper : annualLoss > 0.05 ? C.gold : C.green }}>{(annualLoss * 100).toFixed(1)}%</span>
            <br />Sales-tool approximation using solar-position math (NOAA algorithm) — for permit-grade shading a tool like Aurora / HelioScope with real tree canopies is required.
          </div>
        </div>
      )}
    </div>
  );
}
