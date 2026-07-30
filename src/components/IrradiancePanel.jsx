import { useState } from "react";
import { C, MONTHS } from "../data/constants.js";
import { Sun, Loader2, RefreshCw } from "lucide-react";
import { fetchMonthlyGHI } from "../lib/nasaPower.js";

// Advanced-tab view of the NASA POWER irradiance basis.
//
// The data is fetched automatically when an address is located and is ON by
// default — this panel exists so a rep can SEE the monthly profile and
// deliberately opt out, not to opt in. The Basic tab renders no control at all.
//
// HONEST-DATA NOTE: these values replace the peak-sun-hours assumption only.
// The system derate (device efficiency × 0.88 environmental) is a separate
// loss stage and is untouched by this switch.
export default function IrradiancePanel({
  sitePos, irradiance, setIrradiance, useIrr, setUseIrr, status, setStatus,
}) {
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    if (!sitePos) return;
    setBusy(true); setStatus("loading");
    try {
      setIrradiance(await fetchMonthlyGHI(sitePos.la, sitePos.lo));
      setStatus("ok");
    } catch (err) {
      console.warn("NASA POWER fetch failed — staying on regional average:", err);
      setStatus("failed");
    } finally {
      setBusy(false);
    }
  };

  if (!sitePos) {
    return (
      <div className="mono" style={{ fontSize: 12, color: C.dim, lineHeight: 1.7 }}>
        Locate an address first — irradiance is looked up by coordinates.
        Until then the model uses the utility's regional peak-sun-hours average.
      </div>
    );
  }

  const monthly = irradiance?.monthly;
  const max = monthly ? Math.max(...monthly, 0.01) : 0;
  const active = useIrr && !!monthly;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        {/* default-on switch — the primary control here */}
        <button onClick={() => setUseIrr(!useIrr)} aria-pressed={useIrr} disabled={!monthly}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: active ? C.greenSoft : "transparent",
            border: `1px solid ${active ? C.green : C.line}`,
            color: active ? C.green : C.dim,
            borderRadius: 6, padding: "6px 12px", fontSize: 12.5, fontWeight: 600,
            cursor: monthly ? "pointer" : "not-allowed", fontFamily: "inherit",
          }}>
          <Sun size={13} /> Use NASA POWER irradiance data
        </button>

        <button onClick={reload} disabled={busy} title="Re-fetch from NASA POWER"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "transparent", border: `1px solid ${C.line}`, color: C.dim,
            borderRadius: 6, padding: "6px 10px", fontSize: 12,
            cursor: busy ? "wait" : "pointer", fontFamily: "inherit",
          }}>
          {busy ? <Loader2 size={12} className="spin" /> : <RefreshCw size={12} />}
          Refresh
        </button>
      </div>

      {/* quiet status chips — a fetch failure is never an error dialog */}
      {status === "loading" && (
        <div className="mono" style={{ fontSize: 11.5, color: C.dim, marginBottom: 8 }}>
          Fetching NASA POWER climatology…
        </div>
      )}
      {status === "failed" && (
        <div className="mono" style={{
          display: "inline-block", fontSize: 11.5, color: C.copper, marginBottom: 8,
          background: `${C.copper}18`, border: `1px solid ${C.copper}55`,
          borderRadius: 6, padding: "4px 9px",
        }}>
          Using regional average (NASA data unavailable)
        </div>
      )}
      {status === "ok" && !useIrr && (
        <div className="mono" style={{
          display: "inline-block", fontSize: 11.5, color: C.dim, marginBottom: 8,
          background: `${C.dim}14`, border: `1px solid ${C.line}`,
          borderRadius: 6, padding: "4px 9px",
        }}>
          Switched off — using the utility's regional average
        </div>
      )}

      {monthly && (
        <div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80, marginBottom: 6, opacity: active ? 1 : 0.45 }}>
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
            <br />Values are peak sun hours per day on a horizontal plane. They set the
            irradiance basis only — the system derate is applied separately and is unchanged.
            {active && (
              <><br /><span style={{ color: C.green }}>
                Production = kW × these monthly values × days in month × derate.
              </span></>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
