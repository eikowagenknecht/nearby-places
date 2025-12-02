# Google Maps API Setup Guide

This guide walks you through setting up a Google Maps API key for the Nearby Places tool.

## Prerequisites

- A Google account
- A credit card (required for billing setup, but you get free monthly credits)

## Step-by-Step Instructions

### Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Click on the project dropdown at the top of the page (next to "Google Cloud")
4. Click **"New Project"**
5. Enter a project name (e.g., "Nearby Places")
6. Click **"Create"**
7. Wait for the project to be created (this takes a few seconds)

### Step 2: Set Up Billing Account

Google Maps APIs require a billing account to be enabled, even though they offer generous free usage credits.

**Current free tier (as of December 2024):**
- Check the latest at: https://mapsplatform.google.com/pricing/#pay-as-you-go
- For typical personal use of this tool, you'll stay within the free tier

**To set up billing:**

1. In the Google Cloud Console, make sure your new project is selected
2. Click the hamburger menu (☰) in the top-left corner
3. Navigate to **"Billing"**
4. Click **"Link a billing account"** or **"Add billing account"**
5. Follow the prompts to enter your payment information
6. Review and accept the terms
7. Click **"Start my free trial"** or **"Set account and budget"**

> **Note**: You won't be charged unless you explicitly upgrade from the free tier or exceed the free usage limits.

### Step 3: Enable Required APIs

You need to enable two APIs for this tool to work:

**Enable Geocoding API:**

1. In the Google Cloud Console, make sure your project is selected
2. Open the hamburger menu (☰) and navigate to **"APIs & Services"** > **"Library"**
3. In the search box, type **"Geocoding API"**
4. Click on **"Geocoding API"** in the results
5. Click the **"Enable"** button
6. Wait for the API to be enabled

**Enable Places API:**

1. Go back to the API Library (click "Library" in the left sidebar)
2. In the search box, type **"Places API"**
3. You'll see two options:
   - **"Places API"** (classic)
   - **"Places API (new)"**

   Either one works! The tool supports both.
4. Click on your chosen API
5. Click the **"Enable"** button

### Step 4: Create API Credentials

Now you need to create an API key:

1. In the Google Cloud Console, navigate to **"APIs & Services"** > **"Credentials"**
2. Click **"Create Credentials"** at the top of the page
3. Select **"API key"** from the dropdown
4. Your API key will be created and displayed in a popup dialog
5. **Copy the API key** - you'll need it for the `.env` file
6. You can click **"Edit API key"** to configure restrictions (recommended - see next step)

### Step 5: Restrict Your API Key (Recommended)

For security and to prevent unauthorized usage:

**API Restrictions:**

1. In the API key dialog (or edit your key from the Credentials list)
2. Scroll down to **"API restrictions"**
3. Select **"Restrict key"**
4. Check the boxes for:
   - ☑️ **Geocoding API**
   - ☑️ **Places API** (or "Places API (new)" if you enabled that)
5. Scroll down and click **"Save"**

**Application Restrictions (Optional):**

If you want additional security:

1. Under **"Application restrictions"**
2. Select **"IP addresses"**
3. Add your computer's IP address
4. Click **"Save"**

> **Note**: IP restrictions are optional and may cause issues if your IP address changes frequently.

### Step 6: Add API Key to Your Project

1. In your `nearby-places` project folder, open the `.env` file
2. Add your API key:
   ```
   GOOGLE_API_KEY=your_actual_api_key_here
   ```
3. Save the file

**Important**: Never commit the `.env` file to Git! It's already in `.gitignore` to protect your API key.

## Troubleshooting

### "API key not valid" error

- Make sure you've copied the entire API key
- Check that the Geocoding API and Places API are enabled
- If you set API restrictions, verify they include the required APIs

### "Request denied" error

- Ensure billing is enabled for your project
- Wait a few minutes after enabling the APIs (they can take time to activate)
- Check that your API key is not restricted to different APIs

### "Quota exceeded" error

- Check your usage in the Google Cloud Console under "APIs & Services" > "Dashboard"
- Review your free tier limits at https://mapsplatform.google.com/pricing/
- Consider setting up billing alerts to monitor usage

## Monitoring Usage and Costs

1. Go to **"APIs & Services"** > **"Dashboard"**
2. View your API usage statistics
3. Set up budget alerts:
   - Go to **"Billing"** > **"Budgets & alerts"**
   - Create a budget to get notified before charges occur

## Next Steps

Once your API key is set up, return to the [main README](README.md) to start using the tool!
