export default function Slider({ value, min, max, step, onChange }) {
  return (
    <input type="range" value={value} min={min} max={max} step={step}
      onChange={(e) => onChange(parseFloat(e.target.value))} aria-label="slider" />
  );
}
