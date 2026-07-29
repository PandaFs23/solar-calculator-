import { useState } from "react";
import { C } from "../data/constants.js";
import { Plus, Trash2 } from "lucide-react";

// Track up to 5 existing installed systems. Each row contributes to the
// aggregated existProd used by the calculator. Persisted by the parent via
// useLocalStorage. This complements — doesn't replace — the primary
// "Home has existing solar" toggle in the basic flow.
const MAX_SYSTEMS = 5;

function emptySystem() {
  return {
    id: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now() + Math.random()),
    name: "",
    installedYear: new Date().getFullYear() - 3,
    panelCount: 0,
    panelModel: "",
    inverterModel: "",
    ratedKw: 0,
    measuredKwh: 0,
    shadingFactor: 0,
  };
}

function SysCard({ sys, onChange, onDelete }) {
  const set = (k, v) => onChange({ ...sys, [k]: v });
  const age = Math.max(0, new Date().getFullYear() - Number(sys.installedYear || 0));
  return (
    <div style={{ background: C.night, border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <input value={sys.name} placeholder="System name (e.g. Garage roof)"
          onChange={(e) => set("name", e.target.value)}
          style={{ flex: 1, minWidth: 0, background: "transparent", color: C.text, border: "none",
            borderBottom: `1px solid ${C.line}`, padding: "4px 2px", fontSize: 14, fontFamily: "inherit" }} />
        <button onClick={onDelete} title="Delete this system"
          style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.copper,
            borderRadius: 6, padding: 5, cursor: "pointer" }}>
          <Trash2 size={14} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 11, color: C.dim }}>Rated capacity (kW)</span>
          <input type="number" min={0} step={0.1} value={sys.ratedKw}
            onChange={(e) => set("ratedKw", Number(e.target.value) || 0)}
            style={inputStyle()} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 11, color: C.dim }}>Installed year ({age} yrs old)</span>
          <input type="number" min={1980} max={new Date().getFullYear()}
            value={sys.installedYear}
            onChange={(e) => set("installedYear", Number(e.target.value) || 0)}
            style={inputStyle()} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 11, color: C.dim }}>Panel count</span>
          <input type="number" min={0} value={sys.panelCount}
            onChange={(e) => set("panelCount", Number(e.target.value) || 0)}
            style={inputStyle()} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 11, color: C.dim }}>Measured annual output (kWh)</span>
          <input type="number" min={0} value={sys.measuredKwh}
            onChange={(e) => set("measuredKwh", Number(e.target.value) || 0)}
            placeholder="0 = estimate from kW"
            style={inputStyle()} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 3, gridColumn: "1 / -1" }}>
          <span style={{ fontSize: 11, color: C.dim }}>Panel / inverter model (free text)</span>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={sys.panelModel} placeholder="Panel — e.g. LG NeON 350W"
              onChange={(e) => set("panelModel", e.target.value)}
              style={{ ...inputStyle(), flex: 1, minWidth: 0 }} />
            <input value={sys.inverterModel} placeholder="Inverter — e.g. SolarEdge SE7600H"
              onChange={(e) => set("inverterModel", e.target.value)}
              style={{ ...inputStyle(), flex: 1, minWidth: 0 }} />
          </div>
        </label>
      </div>
    </div>
  );
}

function inputStyle() {
  return {
    background: C.slate, color: C.text, border: `1px solid ${C.line}`,
    borderRadius: 6, padding: "6px 8px", fontSize: 13, fontFamily: "'IBM Plex Mono', monospace",
    minWidth: 0,
  };
}

export default function ExistingSystemsPanel({ systems, setSystems, aggregateKwh }) {
  const [confirmDelete, setConfirmDelete] = useState(null);
  const canAdd = systems.length < MAX_SYSTEMS;

  const updateAt = (id, next) => setSystems(systems.map((s) => (s.id === id ? next : s)));
  const removeAt = (id) => { setSystems(systems.filter((s) => s.id !== id)); setConfirmDelete(null); };

  const combinedKw = systems.reduce((s, x) => s + (Number(x.ratedKw) || 0), 0);
  const totalMeasured = systems.reduce((s, x) => s + (Number(x.measuredKwh) || 0), 0);

  return (
    <div>
      {systems.length === 0 && (
        <div className="mono" style={{ fontSize: 12, color: C.dim, marginBottom: 10, lineHeight: 1.7 }}>
          No tracked systems yet. Add up to {MAX_SYSTEMS} existing installations — each contributes to the aggregated existing production. Persisted in this browser.
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {systems.map((sys) => (
          confirmDelete === sys.id ? (
            <div key={sys.id} style={{ background: C.night, border: `1px solid ${C.copper}`, borderRadius: 10, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 13 }}>Delete "{sys.name || "Untitled system"}"?</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setConfirmDelete(null)}
                  style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.dim, borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                  Cancel
                </button>
                <button onClick={() => removeAt(sys.id)}
                  style={{ background: C.copper, border: "none", color: C.night, borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <SysCard key={sys.id} sys={sys}
              onChange={(next) => updateAt(sys.id, next)}
              onDelete={() => setConfirmDelete(sys.id)} />
          )
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, flexWrap: "wrap", gap: 10 }}>
        <button onClick={() => canAdd && setSystems([...systems, emptySystem()])}
          disabled={!canAdd}
          style={{ display: "flex", alignItems: "center", gap: 6,
            background: canAdd ? C.goldSoft : "transparent",
            border: `1px solid ${canAdd ? C.gold : C.line}`,
            color: canAdd ? C.gold : C.dim,
            borderRadius: 6, padding: "6px 12px", fontSize: 12.5,
            cursor: canAdd ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
          <Plus size={13} /> Add system ({systems.length}/{MAX_SYSTEMS})
        </button>

        {systems.length > 0 && (
          <div className="mono" style={{ fontSize: 11.5, color: C.dim, lineHeight: 1.7 }}>
            Aggregate rated: <span style={{ color: C.green }}>{combinedKw.toFixed(1)} kW</span>{" · "}
            Combined output: <span style={{ color: C.green }}>{Math.round(aggregateKwh).toLocaleString()} kWh/yr</span>
            {totalMeasured > 0 && <><br />(measured: {Math.round(totalMeasured).toLocaleString()} kWh/yr)</>}
          </div>
        )}
      </div>
    </div>
  );
}
