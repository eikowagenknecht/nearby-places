import { writeFileSync, readFileSync, existsSync } from "fs";
import "dotenv/config";

const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) {
  console.error("Error: Set GOOGLE_API_KEY environment variable");
  process.exit(1);
}

const RADIUS_METERS = 1000;
const PLACE_TYPES = ["restaurant", "bar", "cafe", "bakery"];

// API call tracking
let apiCallCount = {
  geocoding: 0,
  placesSearch: 0,
  placesDetails: 0,
  get total() {
    return this.geocoding + this.placesSearch + this.placesDetails;
  },
};

interface Location {
  lat: number;
  lng: number;
}

interface PlaceBasic {
  place_id: string;
  name: string;
  types: string[];
  location: Location;
}

interface PlaceDetailed {
  place_id: string;
  name: string;
  types: string[];
  distance_meters: number;
  location: Location;
  rating: number | null;
  review_count: number;
  price_level: number | null;
  opening_hours: Record<string, string> | null;
  address: string;
  google_maps_url: string;
}

async function geocodeAddress(address: string): Promise<Location> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", API_KEY!);

  apiCallCount.geocoding++;
  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== "OK" || !data.results?.length) {
    throw new Error(`Geocoding failed: ${data.status} - ${data.error_message || "No results"}`);
  }

  const location = data.results[0].geometry.location;
  console.log(`Geocoded "${address}" to ${location.lat}, ${location.lng}`);
  return location;
}

function getSearchPoints(center: Location, radius: number): Array<{ location: Location; radius: number }> {
  const MAX_SEARCH_RADIUS = 1000; // Keep individual searches at 1000m for best results

  // If radius is small enough, just search once
  if (radius <= MAX_SEARCH_RADIUS) {
    return [{ location: center, radius }];
  }

  // For larger radii, create a grid of overlapping search points
  const points: Array<{ location: Location; radius: number }> = [];

  // Always search at center
  points.push({ location: center, radius: MAX_SEARCH_RADIUS });

  // Calculate how many rings we need
  const rings = Math.ceil(radius / MAX_SEARCH_RADIUS);

  // For each ring (except the center), place points around the circle
  for (let ring = 1; ring < rings; ring++) {
    const ringRadius = ring * MAX_SEARCH_RADIUS * 0.8; // 80% to ensure overlap
    const pointsInRing = Math.max(6, Math.ceil(2 * Math.PI * ring * 1.5)); // More points for outer rings

    for (let i = 0; i < pointsInRing; i++) {
      const angle = (2 * Math.PI * i) / pointsInRing;
      const lat = center.lat + (ringRadius / 111320) * Math.cos(angle); // 111320m per degree latitude
      const lng = center.lng + (ringRadius / (111320 * Math.cos(center.lat * Math.PI / 180))) * Math.sin(angle);

      points.push({
        location: { lat, lng },
        radius: MAX_SEARCH_RADIUS,
      });
    }
  }

  return points;
}

async function searchNearby(location: Location, type: string, radius: number): Promise<PlaceBasic[]> {
  const places: PlaceBasic[] = [];
  let nextPageToken: string | undefined;

  do {
    const url = "https://places.googleapis.com/v1/places:searchNearby";

    const body: any = {
      includedTypes: [type],
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: {
            latitude: location.lat,
            longitude: location.lng,
          },
          radius: radius,
        },
      },
    };

    if (nextPageToken) {
      body.pageToken = nextPageToken;
      await sleep(2000);
    }

    apiCallCount.placesSearch++;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY!,
        "X-Goog-FieldMask": "places.id,places.displayName,places.types,places.location",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Nearby search failed: ${response.status} - ${JSON.stringify(data)}`);
    }

    for (const result of data.places || []) {
      // New API returns IDs in format "places/ChIJ..." but we need just the ID part for storage
      const placeId = result.id || result.name;
      places.push({
        place_id: placeId,
        name: result.displayName?.text || result.displayName || "Unknown",
        types: result.types || [],
        location: {
          lat: result.location.latitude,
          lng: result.location.longitude,
        },
      });
    }

    nextPageToken = data.nextPageToken;
    console.log(`Fetched ${data.places?.length || 0} ${type}s (total: ${places.length})${nextPageToken ? ' - has more pages' : ''}`);
  } while (nextPageToken);

  return places;
}

async function getPlaceDetails(placeId: string): Promise<{
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  opening_hours?: { weekday_text?: string[] };
  formatted_address?: string;
  url?: string;
}> {
  // Ensure placeId is in the correct format (places/ChIJ...)
  const fullPlaceId = placeId.startsWith("places/") ? placeId : `places/${placeId}`;
  const url = `https://places.googleapis.com/v1/${fullPlaceId}`;

  apiCallCount.placesDetails++;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY!,
      "X-Goog-FieldMask": "rating,userRatingCount,priceLevel,currentOpeningHours,formattedAddress,googleMapsUri",
    },
  });

  if (!response.ok) {
    console.warn(`Place details failed for ${placeId}: ${response.status}`);
    return {};
  }

  const data = await response.json();

  const priceLevelMap: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };

  return {
    rating: data.rating,
    user_ratings_total: data.userRatingCount,
    price_level: data.priceLevel && data.priceLevel in priceLevelMap ? priceLevelMap[data.priceLevel] : undefined,
    opening_hours: data.currentOpeningHours ? { weekday_text: data.currentOpeningHours.weekdayDescriptions } : undefined,
    formatted_address: data.formattedAddress,
    url: data.googleMapsUri,
  };
}

function haversineDistance(loc1: Location, loc2: Location): number {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(loc2.lat - loc1.lat);
  const dLng = toRad(loc2.lng - loc1.lng);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(loc1.lat)) * Math.cos(toRad(loc2.lat)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function parseOpeningHours(weekdayText?: string[]): Record<string, string> | null {
  if (!weekdayText?.length) return null;

  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const hours: Record<string, string> = {};

  for (const line of weekdayText) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const day = match[1].toLowerCase();
      if (days.includes(day)) {
        hours[day] = match[2];
      }
    }
  }

  return Object.keys(hours).length ? hours : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    return new Set(excluded);
  } catch (err) {
    console.warn(`⚠️  Failed to load exclude.json: ${err}`);
    return new Set();
  }
}

async function main() {
  const address = process.argv[2];

  if (!address) {
    console.error("Usage: npx ts-node fetch-places.ts \"Your Address, City\"");
    process.exit(1);
  }

  console.log(`\nSearching for bars and restaurants within ${RADIUS_METERS}m of "${address}"\n`);

  // Step 1: Geocode address
  const origin = await geocodeAddress(address);

  // Step 1.5: Load exclude list
  const excludeList = loadExcludeList();
  if (excludeList.size > 0) {
    console.log(`📋 Loaded ${excludeList.size} excluded place(s) from exclude.json\n`);
  }

  // Step 2: Adaptive search - try full radius first, subdivide only if needed
  const allPlaces: PlaceBasic[] = [];
  const hitLimitTypes = new Set<string>();

  console.log(`Attempting search with full ${RADIUS_METERS}m radius...\n`);

  for (const type of PLACE_TYPES) {
    const places = await searchNearby(origin, type, RADIUS_METERS);
    allPlaces.push(...places);

    // Check if we hit the 20-result limit (might be missing places)
    if (places.length >= 20) {
      hitLimitTypes.add(type);
      console.log(`  ⚠️  Hit result limit for ${type}s (${places.length} found) - will subdivide search`);
    }
  }

  // Step 3: If we hit limits and radius is large, do subdivided search for those types
  if (hitLimitTypes.size > 0 && RADIUS_METERS > 1000) {
    const searchPoints = getSearchPoints(origin, RADIUS_METERS);
    console.log(`\n🔍 Performing detailed search using ${searchPoints.length} points for ${hitLimitTypes.size} type(s)...\n`);

    for (const type of hitLimitTypes) {
      // Remove initial results for this type
      const initialCount = allPlaces.length;
      for (let i = allPlaces.length - 1; i >= 0; i--) {
        if (allPlaces[i].types.includes(type)) {
          allPlaces.splice(i, 1);
        }
      }

      // Search at all grid points
      for (let i = 0; i < searchPoints.length; i++) {
        const point = searchPoints[i];
        console.log(`  Searching ${type}s at point ${i + 1}/${searchPoints.length}...`);
        const places = await searchNearby(point.location, type, point.radius);
        allPlaces.push(...places);
      }
    }
  } else if (hitLimitTypes.size === 0) {
    console.log(`✓ All place types found complete results (no subdividing needed)\n`);
  }

  // Step 4: Deduplicate by place_id
  const uniquePlaces = new Map<string, PlaceBasic>();
  for (const place of allPlaces) {
    if (!uniquePlaces.has(place.place_id)) {
      uniquePlaces.set(place.place_id, place);
    } else {
      // Merge types
      const existing = uniquePlaces.get(place.place_id)!;
      existing.types = [...new Set([...existing.types, ...place.types])];
    }
  }

  // Step 5: Filter to only places within requested radius from origin and not excluded
  const filtered = Array.from(uniquePlaces.values()).filter((place) => {
    const distance = haversineDistance(origin, place.location);
    const isWithinRadius = distance <= RADIUS_METERS;
    const isNotExcluded = !excludeList.has(place.place_id);
    return isWithinRadius && isNotExcluded;
  });

  const excludedCount = uniquePlaces.size - filtered.length - Array.from(uniquePlaces.values()).filter(p => haversineDistance(origin, p.location) > RADIUS_METERS).length;

  // Rebuild map with filtered places
  uniquePlaces.clear();
  for (const place of filtered) {
    uniquePlaces.set(place.place_id, place);
  }

  console.log(`\nFound ${uniquePlaces.size} unique places within ${RADIUS_METERS}m${excludedCount > 0 ? ` (${excludedCount} excluded)` : ''}\n`);

  // Step 6: Fetch details for each place
  const detailedPlaces: PlaceDetailed[] = [];
  let count = 0;

  for (const [placeId, place] of uniquePlaces) {
    count++;
    console.log(`Fetching details ${count}/${uniquePlaces.size}: ${place.name}`);

    const details = await getPlaceDetails(placeId);
    const distance = haversineDistance(origin, place.location);

    // Filter types to only include relevant ones
    const relevantTypes = place.types.filter((t) =>
      ["restaurant", "bar", "cafe", "bakery", "meal_takeaway", "meal_delivery", "night_club"].includes(t)
    );

    detailedPlaces.push({
      place_id: placeId,
      name: place.name,
      types: relevantTypes.length ? relevantTypes : place.types.slice(0, 3),
      distance_meters: distance,
      location: place.location,
      rating: details.rating ?? null,
      review_count: details.user_ratings_total ?? 0,
      price_level: details.price_level ?? null,
      opening_hours: parseOpeningHours(details.opening_hours?.weekday_text),
      address: details.formatted_address ?? "",
      google_maps_url: details.url ?? "",
    });

    // Small delay to avoid rate limiting
    await sleep(100);
  }

  // Step 5: Sort by distance
  detailedPlaces.sort((a, b) => a.distance_meters - b.distance_meters);

  // Step 6: Output JSON
  const outputFile = "places.json";
  const output = JSON.stringify(detailedPlaces, null, 2);
  writeFileSync(outputFile, output, "utf-8");

  console.log(`\nDone! Saved ${detailedPlaces.length} places to ${outputFile}`);
  console.log(`\n📊 API Usage Summary:`);
  console.log(`   Geocoding API: ${apiCallCount.geocoding} call${apiCallCount.geocoding !== 1 ? 's' : ''}`);
  console.log(`   Places Search API: ${apiCallCount.placesSearch} call${apiCallCount.placesSearch !== 1 ? 's' : ''}`);
  console.log(`   Places Details API: ${apiCallCount.placesDetails} call${apiCallCount.placesDetails !== 1 ? 's' : ''}`);
  console.log(`   Total: ${apiCallCount.total} API calls`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});