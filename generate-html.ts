import { readFileSync, writeFileSync, existsSync } from "fs";

interface Place {
  place_id: string;
  name: string;
  types: string[];
  distance_meters: number;
  location: { lat: number; lng: number };
  rating: number | null;
  review_count: number;
  price_level: number | null;
  opening_hours: Record<string, string> | null;
  address: string;
  google_maps_url: string;
}

function loadExcludeList(): Set<string> {
  const excludeFile = "exclude.json";
  if (!existsSync(excludeFile)) {
    return new Set();
  }

  try {
    const content = readFileSync(excludeFile, "utf-8");
    const excluded = JSON.parse(content);
    if (!Array.isArray(excluded)) {
      console.warn("⚠️  exclude.json is not an array, ignoring");
      return new Set();
    }
    console.log(`📋 Loaded ${excluded.length} excluded place(s) from exclude.json`);
    return new Set(excluded);
  } catch (err) {
    console.warn(`⚠️  Failed to load exclude.json: ${err}`);
    return new Set();
  }
}

const allPlaces: Place[] = JSON.parse(readFileSync("places.json", "utf-8"));
const excludeList = loadExcludeList();
const places: Place[] = allPlaces.filter(place => !excludeList.has(place.place_id));

if (excludeList.size > 0) {
  const excludedCount = allPlaces.length - places.length;
  console.log(`✓ Filtered out ${excludedCount} excluded place(s)\n`);
}

// Calculate center point for map
const avgLat = places.reduce((sum, p) => sum + p.location.lat, 0) / places.length;
const avgLng = places.reduce((sum, p) => sum + p.location.lng, 0) / places.length;

function getPriceLevelSymbol(level: number | null): string {
  if (level === null) return "N/A";
  return "€".repeat(level + 1);
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function getPlaceIcons(types: string[]): string {
  // Map types to icons
  const iconMap: Record<string, string> = {
    "bakery": "🥐",
    "bar": "🍺",
    "cafe": "☕",
    "restaurant": "🍽️",
    "night_club": "🎵",
    "meal_takeaway": "🥡",
    "meal_delivery": "🚚",
    "ice_cream_shop": "🍦",
    "fast_food_restaurant": "🍔"
  };

  // Collect all matching icons
  const icons = types
    .filter(type => type in iconMap)
    .map(type => iconMap[type]);

  // Return icons or default
  return icons.length > 0 ? icons.join("") : "🍴";
}

function getRatingStars(rating: number): string {
  // 3-tier system: ⭐⭐⭐ (4.5+), ⭐⭐ (3.5-4.4), ⭐ (below 3.5)
  if (rating >= 4.5) return "⭐⭐⭐";
  if (rating >= 3.5) return "⭐⭐";
  return "⭐";
}

// Generate Overview HTML
const overviewHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nearby Places - Visit Tracker</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
      background: #f5f5f5;
    }

    h1 {
      margin-bottom: 10px;
      color: #333;
    }

    .summary {
      margin-bottom: 30px;
      color: #666;
      font-size: 14px;
    }

    .place-card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 15px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      break-inside: avoid;
    }

    .place-card:hover {
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }

    .place-header {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 12px;
    }

    .checkbox-container {
      flex-shrink: 0;
    }

    .checkbox {
      width: 24px;
      height: 24px;
      cursor: pointer;
    }

    .place-title {
      flex: 1;
    }

    .place-name {
      font-size: 20px;
      font-weight: 600;
      color: #1a73e8;
      margin-bottom: 4px;
    }

    .place-types {
      font-size: 12px;
      color: #666;
      text-transform: capitalize;
    }

    .place-meta {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
      margin-bottom: 12px;
      font-size: 14px;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .rating {
      color: #f4b400;
      font-weight: 600;
    }

    .distance {
      color: #5f6368;
    }

    .price {
      color: #1e8e3e;
      font-weight: 600;
    }

    .address {
      color: #5f6368;
      font-size: 13px;
      margin-bottom: 8px;
    }

    .hours {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #e0e0e0;
    }

    .hours-title {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 6px;
      color: #333;
    }

    .hours-grid {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 4px 12px;
      font-size: 12px;
    }

    .day {
      font-weight: 500;
      color: #5f6368;
      text-transform: capitalize;
    }

    .time {
      color: #333;
    }

    .links {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #e0e0e0;
    }

    .maps-link {
      display: inline-block;
      color: #1a73e8;
      text-decoration: none;
      font-size: 13px;
      padding: 6px 12px;
      border: 1px solid #1a73e8;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .maps-link:hover {
      background: #1a73e8;
      color: white;
    }

    @media print {
      body {
        background: white;
      }

      .place-card {
        box-shadow: none;
        border: 1px solid #ddd;
        page-break-inside: avoid;
      }

      .maps-link {
        display: none;
      }
    }
  </style>
</head>
<body>
  <h1>🍽️ Nearby Places - Visit Tracker</h1>
  <div class="summary">
    Found ${places.length} places nearby • Check off the ones you've visited!
  </div>

  ${places.map((place, index) => `
    <div class="place-card">
      <div class="place-header">
        <div class="checkbox-container">
          <input type="checkbox" class="checkbox" id="place-${index}">
        </div>
        <div class="place-title">
          <label for="place-${index}" class="place-name">${place.name}</label>
          <div class="place-types">${place.types.join(" • ")}</div>
        </div>
      </div>

      <div class="place-meta">
        <div class="meta-item">
          <span class="distance">📍 ${formatDistance(place.distance_meters)}</span>
        </div>
        ${place.rating ? `
          <div class="meta-item">
            <span class="rating">⭐ ${place.rating}</span>
            <span style="color: #666;">(${place.review_count} reviews)</span>
          </div>
        ` : ''}
        ${place.price_level !== null ? `
          <div class="meta-item">
            <span class="price">${getPriceLevelSymbol(place.price_level)}</span>
          </div>
        ` : ''}
      </div>

      ${place.address ? `
        <div class="address">📍 ${place.address}</div>
      ` : ''}

      ${place.opening_hours ? `
        <div class="hours">
          <div class="hours-title">Opening Hours</div>
          <div class="hours-grid">
            ${Object.entries(place.opening_hours).map(([day, time]) => `
              <div class="day">${day}:</div>
              <div class="time">${time}</div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="links">
        <a href="${place.google_maps_url}" target="_blank" class="maps-link">
          Open in Google Maps →
        </a>
      </div>
    </div>
  `).join('')}

  <script>
    // Save checkbox state to localStorage
    const checkboxes = document.querySelectorAll('.checkbox');

    // Load saved state
    checkboxes.forEach((checkbox, index) => {
      const saved = localStorage.getItem(\`place-\${index}\`);
      if (saved === 'true') {
        checkbox.checked = true;
        checkbox.closest('.place-card').style.opacity = '0.6';
      }
    });

    // Save on change
    checkboxes.forEach((checkbox, index) => {
      checkbox.addEventListener('change', (e) => {
        localStorage.setItem(\`place-\${index}\`, e.target.checked);
        if (e.target.checked) {
          e.target.closest('.place-card').style.opacity = '0.6';
        } else {
          e.target.closest('.place-card').style.opacity = '1';
        }
      });
    });
  </script>
</body>
</html>`;

writeFileSync("overview.html", overviewHtml, "utf-8");
console.log("✅ Generated overview.html");

// Generate Map HTML (using Leaflet.js)
const mapHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nearby Places - Map View</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    #map {
      width: 100%;
      height: 100vh;
    }

    .info-panel {
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

    .info-title {
      font-weight: 600;
      margin-bottom: 8px;
    }

    .info-stats {
      font-size: 14px;
      color: #666;
    }

    .leaflet-popup-content-wrapper {
      border-radius: 8px;
    }

    .popup-content {
      padding: 8px;
    }

    .popup-name {
      font-weight: 600;
      font-size: 16px;
      margin-bottom: 8px;
      color: #1a73e8;
    }

    .popup-meta {
      font-size: 13px;
      margin-bottom: 4px;
      color: #333;
    }

    .popup-link {
      display: inline-block;
      margin-top: 8px;
      color: #1a73e8;
      text-decoration: none;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="info-panel">
    <div class="info-title">🗺️ Nearby Places</div>
    <div class="info-stats">
      ${places.length} locations found
    </div>
  </div>

  <div id="map"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    // Note: We need actual coordinates for the places
    // For now, this is a template. You'll need to modify fetch-places.ts
    // to save the location data in places.json

    const map = L.map('map').setView([${avgLat}, ${avgLng}], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    // Add center marker
    L.marker([${avgLat}, ${avgLng}], {
      icon: L.divIcon({
        className: 'center-marker',
        html: '<div style="background: #1a73e8; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
        iconSize: [20, 20]
      })
    }).addTo(map).bindPopup('<b>Search Center</b>');

    // Add place markers
    const places = ${JSON.stringify(places)};

    places.forEach((place, index) => {
      const marker = L.marker([place.location.lat, place.location.lng]).addTo(map);

      const popupContent = \`
        <div class="popup-content">
          <div class="popup-name">\${place.name}</div>
          \${place.rating ? \`<div class="popup-meta">⭐ \${place.rating} (\${place.review_count} reviews)</div>\` : ''}
          <div class="popup-meta">📍 \${(place.distance_meters < 1000 ? place.distance_meters + 'm' : (place.distance_meters / 1000).toFixed(1) + 'km')}</div>
          \${place.price_level !== null ? \`<div class="popup-meta">💰 \${'€'.repeat(place.price_level + 1)}</div>\` : ''}
          \${place.address ? \`<div class="popup-meta" style="margin-top: 8px; font-size: 12px; color: #666;">\${place.address}</div>\` : ''}
          <a href="\${place.google_maps_url}" target="_blank" class="popup-link">Open in Google Maps →</a>
        </div>
      \`;

      marker.bindPopup(popupContent);
    });
  </script>
</body>
</html>`;

writeFileSync("map.html", mapHtml, "utf-8");
console.log("✅ Generated map.html");

// Generate Condensed List HTML
const condensedHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nearby Places - Condensed List</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
      background: #f5f5f5;
      font-size: 14px;
    }

    h1 {
      font-size: 24px;
      margin-bottom: 20px;
      color: #333;
    }

    .list-container {
      background: white;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .place-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
      border-bottom: 1px solid #e0e0e0;
    }

    .place-row:last-child {
      border-bottom: none;
    }

    .place-row:hover {
      background: #f8f9fa;
    }

    .checkbox {
      width: 18px;
      height: 18px;
      cursor: pointer;
      flex-shrink: 0;
    }

    .place-name {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .place-link {
      font-weight: 500;
      color: #1a73e8;
      text-decoration: none;
      cursor: pointer;
    }

    .place-link:hover {
      text-decoration: underline;
    }

    .place-meta {
      font-size: 12px;
      color: #666;
      font-weight: normal;
    }

    .place-info {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-shrink: 0;
      font-size: 13px;
    }

    .rating {
      color: #f4b400;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .rating-stars {
      font-size: 14px;
      line-height: 1;
    }

    .rating-number {
      font-size: 11px;
      color: #666;
      font-weight: 500;
    }

    .distance {
      color: #5f6368;
      white-space: nowrap;
    }

    .price {
      color: #1e8e3e;
      font-weight: 600;
      white-space: nowrap;
    }

    .export-button {
      margin-top: 20px;
      padding: 12px 24px;
      background: #1a73e8;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .export-button:hover {
      background: #1557b0;
    }

    .export-button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    @media print {
      body {
        background: white;
        padding: 10px;
      }

      .list-container {
        box-shadow: none;
        padding: 0;
      }

      .place-row {
        padding: 4px 0;
        page-break-inside: avoid;
      }

      .export-button {
        display: none;
      }
    }

    @media (max-width: 600px) {
      .place-info {
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
      }
    }
  </style>
</head>
<body>
  <h1>🍴 Places to Try! (${places.length})</h1>

  <div class="list-container">
    ${places.map((place, index) => `
      <div class="place-row" data-place-id="${place.place_id}" data-place-name="${place.name.replace(/"/g, '&quot;')}">
        <input type="checkbox" class="checkbox" id="condensed-${index}">
        <div class="place-name">
          <a href="${place.google_maps_url}" target="_blank" class="place-link">${place.name}</a>
          <span style="font-size: 16px; margin: 0 6px;">${getPlaceIcons(place.types)}</span>
          <span class="place-meta">
            ${formatDistance(place.distance_meters)}${place.price_level !== null ? ` • ${getPriceLevelSymbol(place.price_level)}` : ''}
          </span>
        </div>
        <div class="place-info">
          ${place.rating ? `
            <span class="rating">
              <span class="rating-stars">${getRatingStars(place.rating)}</span>
              <span class="rating-number">${place.rating}</span>
            </span>
          ` : ''}
        </div>
      </div>
    `).join('')}
  </div>

  <button class="export-button" id="exportBtn" disabled>Copy Exclude List (0 selected)</button>

  <script>
    // Save checkbox state to localStorage using place IDs
    const checkboxes = document.querySelectorAll('.checkbox');
    const exportBtn = document.getElementById('exportBtn');

    // Load saved state
    checkboxes.forEach((checkbox) => {
      const row = checkbox.closest('.place-row');
      const placeId = row.dataset.placeId;
      const saved = localStorage.getItem(\`place-\${placeId}\`);
      if (saved === 'true') {
        checkbox.checked = true;
        row.style.opacity = '0.5';
        row.style.textDecoration = 'line-through';
      }
    });

    // Update export button state
    function updateExportButton() {
      const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
      exportBtn.disabled = checkedCount === 0;
      exportBtn.textContent = \`Copy Exclude List (\${checkedCount} selected)\`;
    }

    // Save on change
    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener('change', (e) => {
        const row = e.target.closest('.place-row');
        const placeId = row.dataset.placeId;
        localStorage.setItem(\`place-\${placeId}\`, e.target.checked);
        if (e.target.checked) {
          row.style.opacity = '0.5';
          row.style.textDecoration = 'line-through';
        } else {
          row.style.opacity = '1';
          row.style.textDecoration = 'none';
        }
        updateExportButton();
      });
    });

    // Initial button state
    updateExportButton();

    // Export button click handler
    exportBtn.addEventListener('click', () => {
      const checkedPlaceIds = [];

      checkboxes.forEach((checkbox) => {
        if (checkbox.checked) {
          const row = checkbox.closest('.place-row');
          const placeId = row.dataset.placeId;
          if (placeId) {
            checkedPlaceIds.push(placeId);
          }
        }
      });

      if (checkedPlaceIds.length === 0) return;

      const jsonOutput = JSON.stringify(checkedPlaceIds, null, 2);

      // Copy to clipboard
      navigator.clipboard.writeText(jsonOutput).then(() => {
        const originalText = exportBtn.textContent;
        exportBtn.textContent = '✓ Copied to clipboard!';
        exportBtn.style.background = '#1e8e3e';

        setTimeout(() => {
          exportBtn.textContent = originalText;
          exportBtn.style.background = '#1a73e8';
        }, 2000);
      }).catch(err => {
        alert('Failed to copy to clipboard. Please copy manually:\\n\\n' + jsonOutput);
      });
    });
  </script>
</body>
</html>`;

writeFileSync("list.html", condensedHtml, "utf-8");
console.log("✅ Generated list.html");

console.log("\n📄 Open overview.html to see the detailed printable list");
console.log("📋 Open list.html to see the condensed quick list");
console.log("🗺️  Open map.html to see the interactive map");
