import { useState } from "react";

// The single implementation of the "don't fight the typist" number input.
//
// The bug this exists to prevent: coercing the raw input string to a number on
// every keystroke. Backspacing through "5000" hits "" mid-edit, `Number("")`
// is 0 (or the field snaps back to a default), and the caret jumps — so the
// field is impossible to retype. NumInput and MiniInput were fixed for this;
// this hook is that fix, extracted, so a new numeric field can't quietly
// reintroduce it.
//
// How it works: while focused, the raw string lives in `draft` and the parent
// state is left alone. The value is parsed and clamped once, on blur or Enter.
//
// Options:
//   min / max    clamp bounds, applied at commit
//   integer      round at commit
//   emptyValue   what a cleared field commits. Omit (default) to revert to the
//                previous value — right for a slider-backed control that has no
//                meaningful blank. Pass 0 for a grid cell where "cleared"
//                genuinely means zero.
export default function useNumberDraft(value, onChange, { min, max, integer, emptyValue } = {}) {
  const [draft, setDraft] = useState(null);

  const commit = (raw) => {
    const isBlank = String(raw).trim() === "";
    if (isBlank && emptyValue !== undefined) {
      onChange(emptyValue);
      setDraft(null);
      return;
    }
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      let next = integer ? Math.round(parsed) : parsed;
      if (min != null) next = Math.max(min, next);
      if (max != null) next = Math.min(max, next);
      onChange(next);
    }
    // A blank or unparseable entry with no emptyValue just reverts.
    setDraft(null);
  };

  return {
    // What the input should display: the in-progress string while editing,
    // otherwise whatever the caller wants to show for the committed value.
    displayValue: (formatted) => (draft !== null ? draft : formatted),
    isEditing: draft !== null,
    handlers: {
      onChange: (e) => setDraft(e.target.value),
      onBlur: (e) => commit(e.target.value),
      onKeyDown: (e) => { if (e.key === "Enter") commit(e.currentTarget.value); },
    },
  };
}
