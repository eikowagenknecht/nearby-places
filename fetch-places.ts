import { writeFileSync } from "fs";
import "dotenv/config";

const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) {
  console.error("Error: Set GOOGLE_API_KEY environment variable");
  process.exit(1);
}

const RADIUS_METERS = 1000;
const PLACE_TYPES = ["restaurant", "bar", "cafe", "bakery"];

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

  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== "OK" || !data.results?.length) {
    throw new Error(`Geocoding failed: ${data.status} - ${data.error_message || "No results"}`);
  }

  const location = data.results[0].geometry.location;
  console.log(`Geocoded "${address}" to ${location.lat}, ${location.lng}`);
  return location;
}

async function searchNearby(location: Location, type: string): Promise<PlaceBasic[]> {
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
          radius: RADIUS_METERS,
        },
      },
    };

    if (nextPageToken) {
      body.pageToken = nextPageToken;
      await sleep(2000);
    }

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
    console.log(`Fetched ${data.places?.length || 0} ${type}s (total: ${places.length})`);
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

async function main() {
  const address = process.argv[2];

  if (!address) {
    console.error("Usage: npx ts-node fetch-places.ts \"Your Address, City\"");
    process.exit(1);
  }

  console.log(`\nSearching for bars and restaurants within ${RADIUS_METERS}m of "${address}"\n`);

  // Step 1: Geocode address
  const origin = await geocodeAddress(address);

  // Step 2: Search for places
  const allPlaces: PlaceBasic[] = [];
  for (const type of PLACE_TYPES) {
    const places = await searchNearby(origin, type);
    allPlaces.push(...places);
  }

  // Step 3: Deduplicate by place_id
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
  console.log(`\nFound ${uniquePlaces.size} unique places\n`);

  // Step 4: Fetch details for each place
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
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});