import { useState, useEffect } from "react";

// Small localStorage-backed useState. Reads once on mount, writes on every
// change. Quiet on quota / SSR / private-mode failures — the calculator
// stays fully usable if persistence breaks.
export default function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      return raw != null ? JSON.parse(raw) : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(value));
    } catch { /* quota or unavailable — ignore */ }
  }, [key, value]);
  return [value, setValue];
}
