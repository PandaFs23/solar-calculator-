import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ExternalLink, X } from "lucide-react";
import { C } from "../data/constants.js";
import { FEDERAL_FUN_FACT, FEDERAL_ITEMS, STATE_NAMES, STATE_REGS, fallbackFor } from "../data/regulations.js";

const CATEGORY_LABELS = [
  ["netMetering", "Net Metering & Export Rules"],
  ["hoaSolarAccess", "HOA & Solar Access Rights"],
  ["incentives", "State Incentives & Tax Exemptions"],
  ["permitting", "Permitting & Interconnection"],
  ["federal", "Federal Incentives"],
  ["consumer", "Consumer Protection"],
];

const CATEGORY_FUN_FACTS = { federal: FEDERAL_FUN_FACT };

function CategoryRow({ label, items, funFact, isOpen, onToggle }) {
  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        style={{
          width: "100%", display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 4px",
          background: "transparent", border: "none", borderBottom: `1px solid ${C.line}`,
          cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: C.text,
        }}
      >
        <span style={{ flex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
          <span className="mono" style={{ marginLeft: 8, fontSize: 11, color: C.dim }}>{items.length}</span>
          {funFact && (
            <div className="mono" style={{ fontSize: 10.5, color: C.dim, marginTop: 4, lineHeight: 1.4 }}>{funFact}</div>
          )}
        </span>
        <ChevronDown size={16} color={C.dim} style={{ marginTop: 2, flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </button>
      <div className={`regs-cat-body${isOpen ? " open" : ""}`}>
        <div>
          {isOpen && (
            <div style={{ padding: items.length ? "6px 4px 14px" : "10px 4px 14px" }}>
              {items.length === 0 ? (
                <div className="mono" style={{ fontSize: 11.5, color: C.dim }}>No curated links yet for this category.</div>
              ) : (
                items.map((item, i) => (
                  <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 0",
                      textDecoration: "none", borderTop: i > 0 ? `1px solid ${C.line}` : "none",
                    }}>
                    <ExternalLink size={13} color={C.gold} style={{ marginTop: 3, flexShrink: 0 }} />
                    <span>
                      <span style={{ color: C.gold, textDecoration: "underline", fontSize: 13 }}>{item.name}</span>
                      {item.note && <div style={{ fontSize: 12, color: C.dim, marginTop: 2, lineHeight: 1.45 }}>{item.note}</div>}
                      {item.funFact && (
                        <div className="mono" style={{ fontSize: 10.5, color: C.dim, marginTop: 3, lineHeight: 1.4 }}>{item.funFact}</div>
                      )}
                      {item.verified && (
                        <div className="mono" style={{ fontSize: 10, color: C.dim, marginTop: 3 }}>verified {item.verified}</div>
                      )}
                    </span>
                  </a>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RegulationsPanel({ stateCode }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const stateName = STATE_NAMES[stateCode];
  // Memoized so fallbackFor() (which builds several category arrays per call)
  // only reruns when stateCode actually changes, not on every keystroke in the
  // calculator — RegulationsPanel re-renders with its parent on every input.
  const data = useMemo(() => {
    if (!stateName) return null;
    return STATE_REGS[stateCode] || fallbackFor(stateCode);
  }, [stateCode, stateName]);

  const toggleCategory = (key) => setExpanded((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  if (!stateCode || stateCode === "Other" || !stateName || !data) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "block", width: "100%", marginTop: -14, marginBottom: 22, padding: "9px 12px",
          borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600,
          background: "transparent", border: `1px solid ${C.gold}66`, color: C.gold,
        }}
      >
        ⚖ Solar rules & incentives in {stateName}
      </button>

      {open && (
        <div className="regs-overlay" onClick={() => setOpen(false)}>
          <div
            className="regs-panel" role="dialog" aria-modal="true"
            aria-label={`Solar rules & incentives in ${stateName}`}
            onClick={(e) => e.stopPropagation()}
            style={{ background: C.slate, border: `1px solid ${C.line}`, boxShadow: "0 20px 60px rgba(0,0,0,.5)", display: "flex", flexDirection: "column" }}
          >
            <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>Solar rules & incentives in {stateName}</div>
                {data.funFact && (
                  <div className="mono" style={{ fontSize: 10.5, color: C.dim, marginTop: 6, lineHeight: 1.4 }}>{data.funFact}</div>
                )}
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" title="Close"
                style={{ padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 13, background: "transparent", border: `1px solid ${C.line}`, color: C.dim, flexShrink: 0 }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ padding: "4px 20px", overflowY: "auto", flex: 1 }}>
              {CATEGORY_LABELS.map(([key, label]) => {
                const items = (key === "federal" ? FEDERAL_ITEMS : data.categories[key]) || [];
                return (
                  <CategoryRow key={key} label={label} items={items} funFact={CATEGORY_FUN_FACTS[key] || null}
                    isOpen={expanded.has(key)} onToggle={() => toggleCategory(key)} />
                );
              })}
            </div>

            <div style={{ padding: "12px 20px 16px", borderTop: `1px solid ${C.line}` }}>
              <div className="mono" style={{ fontSize: 10.5, color: C.dim, lineHeight: 1.5 }}>
                Informational only — not legal or tax advice. Rules change; confirm current details with the linked source.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
