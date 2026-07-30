import { useState } from "react";
import { staticMapUrl } from "../lib/geo.js";

// Satellite roof view. Prefers Geoapify's static map (single request, uses the
// SECONDARY key so it never eats the geocoding quota); falls back to the
// keyless Esri World Imagery tile grid when no key is configured or the static
// image fails to load. Either way a map failure is cosmetic — it must never
// block the proposal.
function EsriTiles({ la, lo, height }) {
  const z = 19;
  const n = Math.pow(2, z);
  const latR = (la * Math.PI) / 180;
  const xf = ((lo + 180) / 360) * n;
  const yf = ((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n;
  const tx = Math.floor(xf), ty = Math.floor(yf);
  // pixel position of the point inside the 3x3 (768px) tile grid
  const px = 256 + (xf - tx) * 256;
  const py = 256 + (yf - ty) * 256;
  const tiles = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      tiles.push({ dx, dy, url: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${ty + dy}/${tx + dx}` });
  return (
    <div style={{ position: "absolute", width: 768, height: 768, left: `calc(50% - ${px}px)`, top: `calc(50% - ${py}px)` }}>
      {tiles.map((t, i) => (
        <img key={i} src={t.url} alt="" width={256} height={256} draggable={false}
          style={{ position: "absolute", left: (t.dx + 1) * 256, top: (t.dy + 1) * 256, display: "block" }}
          onError={(e) => { e.currentTarget.style.display = "none"; }} />
      ))}
    </div>
  );
}

export default function AerialView({ la, lo, height = 220 }) {
  const [staticFailed, setStaticFailed] = useState(false);
  const staticUrl = staticMapUrl(la, lo, { width: 600, height: 400, zoom: 19 });
  const useStatic = !!staticUrl && !staticFailed;

  return (
    <div style={{ position: "relative", width: "100%", height, overflow: "hidden", borderRadius: 10, border: "1px solid #22385A", background: "#0B1626" }}>
      {useStatic ? (
        <img src={staticUrl} alt="Satellite view of the located property"
          onError={() => setStaticFailed(true)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        <EsriTiles la={la} lo={lo} height={height} />
      )}
      {/* pin on the house */}
      <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -100%)", pointerEvents: "none" }}>
        <svg width="26" height="34" viewBox="0 0 26 34">
          <path d="M13 0C5.8 0 0 5.8 0 13c0 9.8 13 21 13 21s13-11.2 13-21C26 5.8 20.2 0 13 0z" fill="#F5B62E" stroke="#0B1626" strokeWidth="1.5" />
          <circle cx="13" cy="13" r="5" fill="#0B1626" />
        </svg>
      </div>
      <div className="mono" style={{ position: "absolute", right: 6, bottom: 4, fontSize: 8.5, color: "#fff", textShadow: "0 0 3px #000" }}>
        {useStatic ? "Imagery © Geoapify · Esri" : "Imagery © Esri World Imagery"}
      </div>
    </div>
  );
}
