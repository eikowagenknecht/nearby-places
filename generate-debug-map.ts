import { readFileSync, writeFileSync } from "fs";

interface Place {
  place_id: string;
  name: string;
  distance_meters: number;
  location: { lat: number; lng: number };
}

const places: Place[] = JSON.parse(readFileSync("places.json", "utf-8"));

// Origin from last fetch: Burgwedeler Str. 77, 30657 Hannover
const origin = { lat: 52.4196882, lng: 9.7984223 };
const RADIUS_METERS = 2000;

// Calculate quadrant centers (same logic as fetch-places.ts)
function getQuadrantCenters(center: { lat: number; lng: number }, radius: number) {
  const offsetDistance = radius / 2;
  const quadrantRadius = Math.round(radius * 0.75); // 50% overlap

  const offsetLat = (offsetDistance / 111320);
  const offsetLng = (offsetDistance / (111320 * Math.cos(center.lat * Math.PI / 180)));

  return [
    { name: 'NW', lat: center.lat + offsetLat, lng: center.lng - offsetLng, radius: quadrantRadius },
    { name: 'NE', lat: center.lat + offsetLat, lng: center.lng + offsetLng, radius: quadrantRadius },
    { name: 'SW', lat: center.lat - offsetLat, lng: center.lng - offsetLng, radius: quadrantRadius },
    { name: 'SE', lat: center.lat - offsetLat, lng: center.lng + offsetLng, radius: quadrantRadius },
  ];
}

const firstLevelQuadrants = getQuadrantCenters(origin, RADIUS_METERS);

// SE quadrant was subdivided further
const seQuadrant = firstLevelQuadrants[3]; // SE
const secondLevelQuadrants = getQuadrantCenters(seQuadrant, seQuadrant.radius);

const avgLat = places.reduce((sum, p) => sum + p.location.lat, 0) / places.length;
const avgLng = places.reduce((sum, p) => sum + p.location.lng, 0) / places.length;

const debugHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Debug Map - Search Quadrants</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    #map { width: 100%; height: 100vh; }
    .legend {
      position: absolute;
      top: 10px;
      right: 10px;
      background: white;
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 1000;
      max-width: 300px;
    }
    .legend-title { font-weight: 600; margin-bottom: 8px; }
    .legend-item { font-size: 12px; margin: 4px 0; display: flex; align-items: center; gap: 8px; }
    .legend-color { width: 20px; height: 3px; }
  </style>
</head>
<body>
  <div class="legend">
    <div class="legend-title">🔍 Debug: Search Quadrants</div>
    <div class="legend-item"><div class="legend-color" style="background: red;"></div>Origin (${RADIUS_METERS}m radius)</div>
    <div class="legend-item"><div class="legend-color" style="background: blue;"></div>1st Level Quadrants (1500m, overlapping)</div>
    <div class="legend-item"><div class="legend-color" style="background: green;"></div>2nd Level Quadrants (1125m, overlapping)</div>
    <div class="legend-item"><div class="legend-color" style="background: orange;"></div>Found Places</div>
    <div style="margin-top: 10px; font-size: 11px; color: #666;">
      Circles show actual search areas.<br>
      If Mozzeria is outside circles, it won't be found.
    </div>
  </div>

  <div id="map"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map').setView([${origin.lat}, ${origin.lng}], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    // Origin marker and circle
    L.marker([${origin.lat}, ${origin.lng}], {
      icon: L.divIcon({
        className: 'origin-marker',
        html: '<div style="background: red; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
        iconSize: [16, 16]
      })
    }).addTo(map).bindPopup('<b>Origin</b><br>Burgwedeler Str. 77');

    L.circle([${origin.lat}, ${origin.lng}], {
      radius: ${RADIUS_METERS},
      color: 'red',
      fillColor: '#ff0000',
      fillOpacity: 0.05,
      weight: 2
    }).addTo(map);

    // First level quadrants
    const firstLevel = ${JSON.stringify(firstLevelQuadrants)};
    firstLevel.forEach(quad => {
      L.circle([quad.lat, quad.lng], {
        radius: quad.radius,
        color: 'blue',
        fillColor: '#0000ff',
        fillOpacity: 0.05,
        weight: 2,
        dashArray: '5, 5'
      }).addTo(map).bindPopup(\`<b>\${quad.name} Quadrant</b><br>1000m radius\`);

      L.marker([quad.lat, quad.lng], {
        icon: L.divIcon({
          className: 'quad-marker',
          html: '<div style="background: blue; width: 8px; height: 8px; border-radius: 50%; border: 2px solid white;"></div>',
          iconSize: [8, 8]
        })
      }).addTo(map);
    });

    // Second level quadrants (SE subdivision)
    const secondLevel = ${JSON.stringify(secondLevelQuadrants)};
    secondLevel.forEach(quad => {
      L.circle([quad.lat, quad.lng], {
        radius: quad.radius,
        color: 'green',
        fillColor: '#00ff00',
        fillOpacity: 0.05,
        weight: 1,
        dashArray: '3, 3'
      }).addTo(map).bindPopup(\`<b>SE-\${quad.name}</b><br>500m radius\`);

      L.marker([quad.lat, quad.lng], {
        icon: L.divIcon({
          className: 'quad-marker',
          html: '<div style="background: green; width: 6px; height: 6px; border-radius: 50%; border: 2px solid white;"></div>',
          iconSize: [6, 6]
        })
      }).addTo(map);
    });

    // Found places
    const places = ${JSON.stringify(places)};
    places.forEach(place => {
      L.circleMarker([place.location.lat, place.location.lng], {
        radius: 4,
        color: 'orange',
        fillColor: '#ff8800',
        fillOpacity: 0.8,
        weight: 1
      }).addTo(map).bindPopup(\`<b>\${place.name}</b><br>\${place.distance_meters}m away\`);
    });
  </script>
</body>
</html>`;

writeFileSync("debug-map.html", debugHtml, "utf-8");
console.log("✅ Generated debug-map.html");
console.log("📍 Shows search quadrants and found places");
console.log("🔍 Check if Mozzeria location falls in a gap between circles");
