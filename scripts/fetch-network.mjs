import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import osmtogeojson from 'osmtogeojson';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Overpass query for Ann Arbor
const query = `
[out:json][bbox:42.2227,-83.8054,42.3235,-83.6758];
(
  way["highway"~"primary|secondary|tertiary|residential|unclassified|path|footway|cycleway"];
);
out body;
>;
out skel qt;
`;

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

async function fetchNetwork() {
  console.log('Fetching road network from Overpass API (this may take a minute)...');
  try {
    const response = await fetch(OVERPASS_API_URL, {
      method: 'POST',
      body: query,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (!response.ok) {
      throw new Error(`Overpass API responded with ${response.status}: ${response.statusText}`);
    }

    const osmData = await response.json();
    console.log('Successfully fetched OSM data. Converting to GeoJSON...');

    const geojson = osmtogeojson(osmData);
    
    // Filter out non-LineString features to save space, we only need paths
    geojson.features = geojson.features.filter(f => f.geometry.type === 'LineString');

    const outPath = path.resolve(__dirname, '../public/ann_arbor_network.json');
    fs.writeFileSync(outPath, JSON.stringify(geojson));
    console.log(`Saved network GeoJSON to ${outPath}`);

  } catch (error) {
    console.error('Error fetching network:', error);
    process.exit(1);
  }
}

fetchNetwork();
