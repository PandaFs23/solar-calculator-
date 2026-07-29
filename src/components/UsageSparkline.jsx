import { MONTHS } from "../data/constants.js";

// Pure-SVG mini bar chart of monthly kWh values. No library, no interactivity.
// Highlights months whose value deviates > 30% from the annual average.
export default function UsageSparkline({ values, width = 260, height = 60 }) {
  const nums = values.map((v) => Math.max(0, Number(v) || 0));
  const max = Math.max(1, ...nums);
  const avg = nums.reduce((s, v) => s + v, 0) / 12;
  const barW = width / 12;
  return (
    <svg width={width} height={height + 14} role="img" aria-label="Monthly usage bar chart">
      {nums.map((v, i) => {
        const h = (v / max) * height;
        const anomaly = avg > 0 && Math.abs(v - avg) / avg > 0.3;
        return (
          <g key={i}>
            <rect x={i * barW + 1} y={height - h} width={barW - 2} height={h}
              fill={anomaly ? "#E08E45" : "#F5B62E"} rx={1.5} />
            <text x={i * barW + barW / 2} y={height + 11} fontSize="8.5" fill="#8FA3BC"
              textAnchor="middle" fontFamily="'IBM Plex Mono', monospace">
              {MONTHS[i][0]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
