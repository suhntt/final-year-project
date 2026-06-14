import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// ✅ leaflet.heat is a legacy UMD global plugin — it must be loaded dynamically
// at runtime (NOT as a static import) because it expects window.L to exist.
// Static `import 'leaflet.heat'` causes Vite to hang during bundle transform.
let heatLoaded = false;

async function ensureHeatPlugin() {
  if (heatLoaded) return;
  // Make L available globally so leaflet.heat can attach itself
  window.L = L;
  await import('leaflet.heat');
  heatLoaded = true;
}

export default function HeatmapLayer({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !points || points.length === 0) return;

    let heatLayer = null;

    ensureHeatPlugin().then(() => {
      const heatData = points.map(p => {
        const severityMultiplier =
          p.severity === 'High' ? 1.0 : p.severity === 'Low' ? 0.3 : 0.6;
        return [parseFloat(p.latitude), parseFloat(p.longitude), severityMultiplier];
      }).filter(p => !isNaN(p[0]) && !isNaN(p[1]));

      if (heatData.length === 0) return;

      heatLayer = L.heatLayer(heatData, {
        radius: 25,
        blur: 15,
        maxZoom: 14,
        gradient: { 0.4: 'blue', 0.6: 'lime', 0.8: 'orange', 1: 'red' }
      });

      heatLayer.addTo(map);
    }).catch(err => {
      console.warn('⚠️ HeatmapLayer failed to load leaflet.heat:', err.message);
    });

    return () => {
      if (heatLayer && map) {
        try { map.removeLayer(heatLayer); } catch (_) {}
      }
    };
  }, [map, points]);

  return null;
}
