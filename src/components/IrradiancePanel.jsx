import { useState } from "react";
import { C, MONTHS } from "../data/constants.js";
import { Sun, Loader2 } from "lucide-react";
import { fetchMonthlyGHI } from "../lib/nasaPower.js";

// NASA POWER-backed monthly GHI panel. Shows monthly kWh/m²/day and an
// annual average. "Use this data" applies the monthly series to the
// production calc (via monthlyIrradiance override). The site must be
// located first (needs lat/lon).
export default function IrradiancePanel({ sitePos, irradiance, setIrradiance, useIrr, setUseIrr }) {
  const [state, setState] = useState("idle"); // idle | loading | error
  const [msg, setMsg] = useState("");

  const load = async () => {
    if (!sitePos) return;
    setState("loading"); setMsg("Fetching NASA POWER climatology…");
    try {
      const data = await fetchMonthlyGHI(sitePos.la, sitePos.lo);
      setIrradiance(data);
      setState("idle"); setMsg("");
    } catch (err) {
      console.warn("NASA POWER fetch failed:", err);
      setState("error"); setMsg("Couldn't fetch NASA POWER — try again in a moment.");
    }
  };

  if (!sitePos) {
    return (
      <div className="mono" style={{ fontSize: 12, color: C.copper, lineHeight: 1.7 }}>
        Locate an address first — irradiance data is looked up by coordinates.
      </div>
    );
  }

  const monthly = irradiance?.monthly;
  const max = monthly ? Math.max(...monthly, 0.01) : 0;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={load} disabled={state === "loading"}
          style={{ display: "flex", alignItems: "center", gap: 6,
            background: C.goldSoft, border: `1px solid ${C.gold}`, color: C.gold,
            borderRadius: 6, padding: "6px 12px", fontSize: 12.5,
            cursor: state === "loading" ? "wait" : "pointer", fontFamily: "inherit" }}>
          {state === "loading" ? <Loader2 size={13} className="spin" /> : <Sun size={13} />}
          {irradiance ? "Refresh from NASA POWER" : "Fetch NASA POWER data"}
        </button>
        {irradiance && (
          <button onClick={() => setUseIrr(!useIrr)} aria-pressed={useIrr}
            style={{ background: useIrr ? C.green : "transparent",
              border: `1px solid ${useIrr ? C.green : C.line}`,
              color: useIrr ? C.night : C.dim,
              borderRadius: 6, padding: "6px 12px", fontSize: 12.5, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit" }}>
            {useIrr ? "Using NASA data" : "Apply to calculation"}
          </button>
        )}
      </div>

      {msg && (
        <div className="mono" style={{ fontSize: 11.5, color: state === "error" ? C.copper : C.dim, marginBottom: 8 }}>
          {msg}
        </div>
      )}

      {monthly && (
        <div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80, marginBottom: 6 }}>
            {monthly.map((v, i) => {
              const h = Math.max(3, (v / max) * 80);
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <span className="mono" style={{ fontSize: 9, color: C.gold }}>{v.toFixed(1)}</span>
                  <div style={{ width: "100%", height: h, background: `linear-gradient(180deg, ${C.gold}, ${C.copper})`, borderRadius: 2 }} />
                  <span className="mono" style={{ fontSize: 8, color: C.dim }}>{MONTHS[i][0]}</span>
                </div>
              );
            })}
          </div>
          <div className="mono" style={{ fontSize: 11.5, color: C.dim, lineHeight: 1.7 }}>
            Annual average: <span style={{ color: C.gold }}>{irradiance.annualDailyAvg.toFixed(2)} kWh/m²/day</span>
            <br />Source: {irradiance.source}. Free, no API key.
            {useIrr && <><br /><span style={{ color: C.green }}>Monthly production now distributes by these values instead of the seasonal default.</span></>}
          </div>
        </div>
      )}
    </div>
  );
}
