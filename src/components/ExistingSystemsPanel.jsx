import { useState } from "react";
import { C } from "../data/constants.js";
import { Plus, Trash2, Zap } from "lucide-react";
import {
  MAX_SYSTEMS, emptySystem, normalizeSystem,
  systemRatedKw, systemPanelCount, systemAge, aggregateRatedKw,
} from "../lib/existingSystems.js";

// Additional existing arrays, beyond the primary "Home has existing solar"
// card. A home can already have more than one array — main roof + garage, or a
// later expansion on a different inverter.
//
// The primary card above is entry 1 and always stays; these are entries 2..5,
// each independently removable. `maxAdditional` is 5 minus however many the
// primary card is already claiming, so the total never exceeds MAX_SYSTEMS.
//
// Capacity has ONE basis per entry: enter panels × watts and kW is computed,
// or enter kW and the panel count is computed. The derived side renders
// read-only, so the two can never drift apart.

function SysCard({ sys, index, onChange, onDelete, inverterOptions }) {
  const s = normalizeSystem(sys);
  const set = (k, v) => onChange({ ...s, [k]: v });
  const age = systemAge(s);
  const kw = systemRatedKw(s);
  const count = systemPanelCount(s);
  const byPanels = s.sizeBasis === "panels";

  return (
    <div style={{ background: C.night, border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <input value={s.name} placeholder={`System name (e.g. ${index === 0 ? "Garage roof" : "Back slope"})`}
          maxLength={60}
          onChange={(e) => set("name", e.target.value)}
          style={{ flex: 1, minWidth: 0, background: "transparent", color: C.text, border: "none",
            borderBottom: `1px solid ${C.line}`, padding: "4px 2px", fontSize: 14, fontFamily: "inherit" }} />
        <button onClick={onDelete} title="Remove this system"
          style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.copper,
            borderRadius: 6, padding: 5, cursor: "pointer", lineHeight: 0 }}>
          <Trash2 size={14} />
        </button>
      </div>

      {/* which side of the size relationship the rep is entering */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: C.dim }}>Size from:</span>
        {[["panels", "Panels × watts"], ["kw", "Rated kW"]].map(([id, label]) => (
          <button key={id} onClick={() => set("sizeBasis", id)} aria-pressed={s.sizeBasis === id}
            style={{
              background: s.sizeBasis === id ? C.goldSoft : "transparent",
              border: `1px solid ${s.sizeBasis === id ? C.gold : C.line}`,
              color: s.sizeBasis === id ? C.gold : C.dim,
              borderRadius: 999, padding: "3px 10px", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit",
            }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 11, color: C.dim }}>Panel count</span>
          {byPanels ? (
            <input type="number" min={0} value={s.panelCount || ""} placeholder="0"
              onChange={(e) => set("panelCount", Math.max(0, Number(e.target.value) || 0))}
              style={inputStyle()} />
          ) : (
            <Derived value={count} unit="panels" />
          )}
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 11, color: C.dim }}>Panel wattage (W)</span>
          <input type="number" min={0} step={5} value={s.panelWatts || ""} placeholder="350"
            onChange={(e) => set("panelWatts", Math.max(0, Number(e.target.value) || 0))}
            style={inputStyle()} />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 11, color: C.dim }}>Rated capacity (kW DC)</span>
          {byPanels ? (
            <Derived value={kw} unit="kW" decimals={2} />
          ) : (
            <input type="number" min={0} step={0.1} value={s.ratedKw || ""} placeholder="0"
              onChange={(e) => set("ratedKw", Math.max(0, Number(e.target.value) || 0))}
              style={inputStyle()} />
          )}
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 11, color: C.dim }}>Installed year ({age} yrs old)</span>
          <input type="number" min={1980} max={new Date().getFullYear()}
            value={s.installedYear || ""}
            onChange={(e) => set("installedYear", Number(e.target.value) || 0)}
            style={inputStyle()} />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 3, gridColumn: "1 / -1" }}>
          <span style={{ fontSize: 11, color: C.dim }}>
            Inverter / optimizer — sets this system's derate
          </span>
          <select value={s.invProdId || ""} onChange={(e) => set("invProdId", e.target.value)}
            style={{ ...inputStyle(), cursor: "pointer" }}>
            <option value="">Not sure / generic</option>
            {inverterOptions.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {(p.derate * 100).toFixed(1)}% system
                    {p.discontinued ? " · discontinued" : p.legacy ? " · legacy" : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 3, gridColumn: "1 / -1" }}>
          <span style={{ fontSize: 11, color: C.dim }}>Measured annual output (kWh) — overrides the estimate</span>
          <input type="number" min={0} value={s.measuredKwh || ""}
            onChange={(e) => set("measuredKwh", Math.max(0, Number(e.target.value) || 0))}
            placeholder="0 = estimate from capacity"
            style={inputStyle()} />
        </label>
      </div>
    </div>
  );
}

// Read-only companion to whichever field is the source of truth.
function Derived({ value, unit, decimals = 0 }) {
  return (
    <div className="mono" title="Computed from the other field — switch the size basis to edit"
      style={{
        background: "transparent", color: C.green, border: `1px dashed ${C.line}`,
        borderRadius: 6, padding: "6px 8px", fontSize: 13, minWidth: 0,
        display: "flex", alignItems: "center", gap: 5,
      }}>
      {value.toFixed(decimals)} <span style={{ color: C.dim, fontSize: 11 }}>{unit} · computed</span>
    </div>
  );
}

function inputStyle() {
  return {
    background: C.slate, color: C.text, border: `1px solid ${C.line}`,
    borderRadius: 6, padding: "6px 8px", fontSize: 13, fontFamily: "'IBM Plex Mono', monospace",
    minWidth: 0, width: "100%", boxSizing: "border-box",
  };
}

export default function ExistingSystemsPanel({
  systems, setSystems, aggregateKwh, inverterOptions = [],
  maxAdditional = MAX_SYSTEMS, primaryCounted = false,
}) {
  const [confirmDelete, setConfirmDelete] = useState(null);
  const canAdd = systems.length < maxAdditional;
  const totalTracked = systems.length + (primaryCounted ? 1 : 0);

  const updateAt = (id, next) => setSystems(systems.map((s) => (s.id === id ? next : s)));
  const removeAt = (id) => { setSystems(systems.filter((s) => s.id !== id)); setConfirmDelete(null); };

  const combinedKw = aggregateRatedKw(systems);

  return (
    <div>
      <div style={{ display: "grid", gap: 10 }}>
        {systems.map((sys, i) => (
          confirmDelete === sys.id ? (
            <div key={sys.id} style={{ background: C.night, border: `1px solid ${C.copper}`, borderRadius: 10, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13 }}>Remove "{sys.name || `System ${i + 1}`}"?</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setConfirmDelete(null)}
                  style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.dim, borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                  Cancel
                </button>
                <button onClick={() => removeAt(sys.id)}
                  style={{ background: C.copper, border: "none", color: C.night, borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <SysCard key={sys.id} sys={sys} index={i}
              inverterOptions={inverterOptions}
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
          <Plus size={13} />
          {canAdd ? "Add another existing system" : `Maximum ${MAX_SYSTEMS} systems reached`}
          <span style={{ opacity: 0.7 }}>
            ({totalTracked}/{MAX_SYSTEMS}{primaryCounted ? " incl. primary" : ""})
          </span>
        </button>

        {combinedKw > 0 && (
          <div className="mono" style={{ fontSize: 11.5, color: C.dim, lineHeight: 1.7, display: "flex", alignItems: "center", gap: 6 }}>
            <Zap size={12} color={C.green} />
            <span>
              Aggregate rated: <span style={{ color: C.green }}>{combinedKw.toFixed(1)} kW</span>{" · "}
              Combined output: <span style={{ color: C.green }}>{Math.round(aggregateKwh).toLocaleString()} kWh/yr</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
