# Nearby Places

A command-line tool to find restaurants, bars, cafes, and bakeries near any address using the Google Maps API. Generate printable lists and interactive maps to discover new places!

> **Note**: This tool requires a Google Maps API key with billing enabled. You get $200/month free credit, which is typically sufficient for personal use.

## Preview

### Condensed List View
Perfect for printing and hanging on your fridge!

![List View](screenshots/list-view.png)

### Detailed Overview
Complete information with opening hours and reviews.

![Overview](screenshots/overview-view.png)

### Interactive Map
Explore places on an interactive map.

![Map View](screenshots/map-view.png)

## Features

- Geocodes any address to coordinates
- Searches for restaurants and bars within 1000m radius
- Fetches detailed information including:
  - Ratings and review counts
  - Price levels
  - Opening hours
  - Full addresses
  - Google Maps URLs
- Calculates accurate distances using Haversine formula
- Outputs sorted results to JSON file

## Prerequisites

- Node.js (v18 or higher recommended)
- Google Maps API key with the following APIs enabled:
  - Geocoding API
  - Places API

## Installation

```bash
cd nearby-places
npm install
```

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Then edit the `.env` file and add your Google Maps API key:

```
GOOGLE_API_KEY=your_actual_api_key_here
```

## Getting a Google Maps API Key

### Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Click on the project dropdown at the top of the page
4. Click "New Project"
5. Enter a project name (e.g., "Nearby Places")
6. Click "Create"

### Step 2: Set Up Billing Account

Google Maps APIs require a billing account, but don't worry:
- You get **$200 free credit per month**
- You only pay if you exceed this amount
- For typical use of this tool, you'll stay within the free tier

To set up billing:

1. In the Google Cloud Console, navigate to "Billing" in the left sidebar
2. Click "Link a billing account" or "Add billing account"
3. Follow the prompts to enter your payment information
4. Complete the billing setup

### Step 3: Enable Required APIs

1. In the Google Cloud Console, make sure your new project is selected
2. Navigate to "APIs & Services" > "Library" (use the left sidebar menu)
3. Search for "Geocoding API" and click on it
4. Click the "Enable" button
5. Go back to the API Library
6. Search for "Places API" and click on it
   - Note: You can enable either "Places API" or "Places API (new)" - both work
7. Click the "Enable" button

### Step 4: Create API Credentials

1. Navigate to "APIs & Services" > "Credentials"
2. Click "Create Credentials" at the top
3. Select "API key"
4. Your API key will be created and displayed
5. Copy the API key - you'll need it to run the tool

### Step 5: (Optional but Recommended) Restrict Your API Key

To prevent unauthorized use and unexpected charges:

1. In the API key dialog, click "Edit API key" (or find your key in the Credentials list)
2. Under "API restrictions":
   - Select "Restrict key"
   - Check "Geocoding API"
   - Check "Places API"
3. Under "Application restrictions" (optional):
   - You can restrict by IP address if you want additional security
4. Click "Save"

## Usage

Once you've set up your `.env` file with your API key, simply run:

```bash
npm start "Your Street 123, 30159 Hannover"
```

The tool will automatically load your API key from the `.env` file.

## Viewing Results

After fetching places, you can generate HTML visualizations:

```bash
npm run generate-html
```

This creates three files:

1. **list.html** - Condensed quick list
   - Minimal one-line view with checkboxes
   - Shows only: name, rating, distance, price level
   - Perfect for quick scanning and printing
   - Saves your visit history in browser localStorage

2. **overview.html** - Detailed printable checklist
   - Track which places you've visited with checkboxes
   - Shows ratings, hours, distance, and price levels
   - Full details in card layout
   - Print-friendly with all information

3. **map.html** - Interactive map view
   - All places displayed on an OpenStreetMap
   - Click markers to see place details
   - Blue center marker shows your search location
   - Free and doesn't require additional API keys

Open these HTML files directly in your browser!

## Output

The tool generates a `places.json` file containing an array of places with the following information:

```json
[
  {
    "name": "Restaurant Name",
    "types": ["restaurant", "bar"],
    "distance_meters": 250,
    "rating": 4.5,
    "review_count": 123,
    "price_level": 2,
    "opening_hours": {
      "monday": "11:00 AM – 10:00 PM",
      "tuesday": "11:00 AM – 10:00 PM",
      ...
    },
    "address": "Full Street Address",
    "google_maps_url": "https://maps.google.com/?cid=..."
  }
]
```

Results are sorted by distance from the specified address.

## Customization

You can modify the following constants in `fetch-places.ts`:

- `RADIUS_METERS`: Search radius (default: 1000)
- `PLACE_TYPES`: Types of places to search for (default: ["restaurant", "bar"])

## License

MIT
