import maplibregl from "maplibre-gl";
import { createClient } from "@supabase/supabase-js";
import proj4 from "proj4";
import "./style.css";

// ============================================================================
// COORDINATE SYSTEM CONVERSION: EPSG:25833 (UTM Zone 33) to EPSG:4326 (WGS84)
// ============================================================================

// Define projections
proj4.defs('EPSG:25833', '+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs');
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');

/**
 * Convert a single coordinate pair from EPSG:25833 (UTM Zone 33) to EPSG:4326 (WGS84)
 * @param {number} easting - X coordinate in UTM 33 (meters)
 * @param {number} northing - Y coordinate in UTM 33 (meters)
 * @returns {number[]} - [longitude, latitude] in WGS84
 */
function convertUTM33toWGS84(easting, northing) {
  return proj4('EPSG:25833', 'EPSG:4326', [easting, northing]);
}

/**
 * Convert a single coordinate pair from EPSG:4326 (WGS84) to EPSG:25833 (UTM Zone 33)
 * @param {number} longitude - Longitude in WGS84
 * @param {number} latitude - Latitude in WGS84
 * @returns {number[]} - [easting, northing] in UTM 33 (meters)
 */
function convertWGS84toUTM33(longitude, latitude) {
  return proj4('EPSG:4326', 'EPSG:25833', [longitude, latitude]);
}

/**
 * Convert a GeoJSON feature from EPSG:25833 to EPSG:4326
 * Handles Point, LineString, Polygon, MultiPoint, MultiLineString, and MultiPolygon
 * @param {object} geoJsonFeature - GeoJSON feature with geometry in EPSG:25833
 * @returns {object} - Feature with geometry converted to EPSG:4326
 */
function convertGeoJSONfrom25833to4326(geoJsonFeature) {
  const geom = geoJsonFeature.geometry;
  
  function transformCoordinates(coords, depth = 0, targetDepth = 1) {
    // For Point (depth 0), we have [easting, northing]
    // For LineString/MultiPoint (depth 1), we have [[e,n], [e,n], ...]
    // For Polygon/MultiLineString (depth 2), we have [[[e,n], [e,n]], ...]
    // For MultiPolygon (depth 3), we have [[[[e,n], [e,n]], ...]]
    
    if (depth === targetDepth) {
      return convertUTM33toWGS84(coords[0], coords[1]);
    }
    return coords.map(c => transformCoordinates(c, depth + 1, targetDepth));
  }

  const converted = { ...geoJsonFeature };
  
  switch (geom.type) {
    case 'Point':
      converted.geometry.coordinates = transformCoordinates(geom.coordinates, 0, 0);
      break;
    case 'LineString':
    case 'MultiPoint':
      converted.geometry.coordinates = transformCoordinates(geom.coordinates, 0, 1);
      break;
    case 'Polygon':
    case 'MultiLineString':
      converted.geometry.coordinates = transformCoordinates(geom.coordinates, 0, 2);
      break;
    case 'MultiPolygon':
      converted.geometry.coordinates = transformCoordinates(geom.coordinates, 0, 3);
      break;
  }
  
  return converted;
}

/**
 * Convert a GeoJSON feature from EPSG:4326 to EPSG:25833
 * Handles all geometry types
 * @param {object} geoJsonFeature - GeoJSON feature with geometry in EPSG:4326
 * @returns {object} - Feature with geometry converted to EPSG:25833
 */
function convertGeoJSONfrom4326to25833(geoJsonFeature) {
  const geom = geoJsonFeature.geometry;
  
  function transformCoordinates(coords, depth = 0, targetDepth = 1) {
    if (depth === targetDepth) {
      return convertWGS84toUTM33(coords[0], coords[1]);
    }
    return coords.map(c => transformCoordinates(c, depth + 1, targetDepth));
  }

  const converted = { ...geoJsonFeature };
  
  switch (geom.type) {
    case 'Point':
      converted.geometry.coordinates = transformCoordinates(geom.coordinates, 0, 0);
      break;
    case 'LineString':
    case 'MultiPoint':
      converted.geometry.coordinates = transformCoordinates(geom.coordinates, 0, 1);
      break;
    case 'Polygon':
    case 'MultiLineString':
      converted.geometry.coordinates = transformCoordinates(geom.coordinates, 0, 2);
      break;
    case 'MultiPolygon':
      converted.geometry.coordinates = transformCoordinates(geom.coordinates, 0, 3);
      break;
  }
  
  return converted;
}

const TEAM_SUPABASE_URL = "https://zdegeuncqvgqzjszwtqc.supabase.co";
const TEAM_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkZWdldW5jcXZncXpqc3p3dHFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMjA2NjUsImV4cCI6MjA4NTY5NjY2NX0.UZJzfZnPwhMr7Z3cCgj_5_DJsz9KdTtFFgXBq6uSOSo";

const envSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const envSupabaseKey = (
  import.meta.env.VITE_SUPABASE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || ""
).trim();

const resolvedSupabaseUrl =
  envSupabaseUrl && !envSupabaseUrl.includes("your-supabase-url")
    ? envSupabaseUrl
    : TEAM_SUPABASE_URL;

const resolvedSupabaseKey =
  envSupabaseKey && envSupabaseKey !== "public-anon-key" && envSupabaseKey !== "your-anon-public-key"
    ? envSupabaseKey
    : TEAM_SUPABASE_ANON_KEY;

const config = {
  baseStyle: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  elveg: {
    wmsUrl: "https://wms.geonorge.no/skwms1/wms.vegnett2",
    layer: "vegnett2"
  },
  nvdb: {
    baseUrl: "/nvdb",
    roadnetPath: "/vegnett/veglenkesekvenser",
    heightPath: "/vegobjekter/591",
    widthPath: "/vegobjekter/838",
    weightPath: "/vegobjekter/904",
    maxFeatures: 300,
    minZoom: 10
  },
  supabase: {
    url: resolvedSupabaseUrl,
    key: resolvedSupabaseKey,
    rockslide: {
      radiusMeters: 1000,
      rpcName: "check_rockslide_risk_near_point",
      schemaCandidates: ["skredfaresoner_309c116d2f944bae99c20d0a1336a2bd", "public"],
      requirePostgisRpc: true,
      tableCandidates: [
        "skredfaresone"
      ],
      rockslideTypeKeywords: ["stein", "rock"]
    }
  }
};

const supabase = config.supabase.url && config.supabase.key 
  ? createClient(config.supabase.url, config.supabase.key)
  : null;

const root = document.getElementById("app");
root.innerHTML = `
  <aside class="panel">
    <h1>Kriseveier for spesialkjøretøy</h1>
    <p>Vegnett og restriksjoner lastes dynamisk fra NVDB basert på kartutsnitt.</p>

    <section>
      <h3>Kjøretøybredde</h3>
      <div class="layer-list">
        <label class="control-row">
          <span class="control-label">Bredde (m)</span>
          <input type="number" id="vehicle-width" min="0" step="0.1" placeholder="F.eks. 2.6" />
        </label>
        <label class="control-row">
          <span class="control-label">Høyde (m)</span>
          <input type="number" id="vehicle-height" min="0" step="0.1" placeholder="F.eks. 4.2" />
        </label>
        <label class="control-row">
          <input type="checkbox" id="toggle-hide-too-narrow" /> Skjul veier som er for smale
        </label>
        <label class="control-row">
          <input type="checkbox" id="toggle-hide-too-low" /> Skjul veier med for lav høyde
        </label>
      </div>
      <p class="note">Krever NVDB vegbredde (objekt 838) og høydebegrensning (objekt 591). Ukjent verdi vises fortsatt.</p>
    </section>

    <section>
      <h3>Lagstyring</h3>
      <div class="layer-list">
        <label class="control-row">
          <input type="checkbox" id="toggle-elveg" checked /> Elveg vegnett (WMS)
        </label>
        <label class="control-row">
          <input type="checkbox" id="toggle-roadnet" /> NVDB vegnett (data)
        </label>
        <label class="control-row">
          <input type="checkbox" id="toggle-height" checked /> NVDB høydebegrensning
        </label>
        <label class="control-row">
          <input type="checkbox" id="toggle-width" checked /> NVDB vegbredde
        </label>
        <label class="control-row">
          <input type="checkbox" id="toggle-weight" checked /> NVDB bruksklasse (vekt)
        </label>
      </div>
      <p class="note">Zoom inn for å laste mer detaljerte NVDB-data.</p>
    </section>

    <section>
      <h3>Tegnforklaring</h3>
      <div class="legend">
        <div class="legend-row"><span class="legend-swatch elveg"></span>Vegnett (Elveg WMS)</div>
        <div class="legend-row"><span class="legend-swatch roadnet"></span>Vegnett (NVDB)</div>
        <div class="legend-row"><span class="legend-swatch height"></span>Høydebegrensning</div>
        <div class="legend-row"><span class="legend-swatch width"></span>Vegbredde (NVDB)</div>
        <div class="legend-row"><span class="legend-swatch weight"></span>Bruksklasse (vekt)</div>
      </div>
      <p class="note">Kartet viser vegnett, høydebegrensninger, vegbredde og bruksklasse for vekt fra NVDB, lastet per kartutsnitt.</p>
    </section>

    <section>
      <h3>Supabase Database</h3>
      <div class="layer-list">
        <label class="control-row">
          <input type="checkbox" id="toggle-road-segments" /> Vegsegmenter
        </label>
        <label class="control-row">
          <input type="checkbox" id="toggle-tunnels" /> Tunneler
        </label>
        <label class="control-row">
          <input type="checkbox" id="toggle-vehicle-details" /> Kjøretøy detaljer
        </label>
      </div>
      <button id="load-supabase" disabled>Last data fra Supabase</button>
      <p class="note" id="supabase-status">Kobler til database...</p>
      <p class="note" id="rockslide-status">Klikk i kartet for å sjekke steinskredfare innen 1 km.</p>
    </section>
  </aside>
  <main id="map"></main>
`;

const map = new maplibregl.Map({
  container: "map",
  style: config.baseStyle,
  center: [7.9956, 58.1467],
  zoom: 11
});

map.addControl(new maplibregl.NavigationControl(), "top-right");

map.on("load", () => {
  addElvegLayer();
  addNvdbRoadnetLayer();
  addNvdbHeightLayer();
  addNvdbWidthLayer();
  addNvdbWeightLayer();
  scheduleNvdbFetch();
});

let nvdbFetchTimer;
let nvdbRequestId = 0;

let vehicleWidthMeters = null;
let hideTooNarrowRoads = false;

let vehicleHeightMeters = null;
let hideTooLowRoads = false;

let selectedPointMarker = null;
let rockslideRequestId = 0;

function setSelectedPointMarker(lngLat) {
  if (selectedPointMarker) {
    selectedPointMarker.remove();
  }

  const el = document.createElement("div");
  el.className = "selected-point-marker";
  selectedPointMarker = new maplibregl.Marker({ element: el, anchor: "center" })
    .setLngLat(lngLat)
    .addTo(map);
}

function addElvegLayer() {
  const wmsTileUrl = `${config.elveg.wmsUrl}?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${config.elveg.layer}&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256`;
  map.addSource("elveg-wms", {
    type: "raster",
    tiles: [wmsTileUrl],
    tileSize: 256
  });

  map.addLayer({
    id: "elveg-wms-layer",
    type: "raster",
    source: "elveg-wms",
    paint: {
      "raster-opacity": 0.85
    }
  });
}

function addNvdbRoadnetLayer() {
  map.addSource("nvdb-roadnet", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] }
  });

  map.addLayer({
    id: "nvdb-roadnet-line",
    type: "line",
    source: "nvdb-roadnet",
    layout: {
      visibility: "none"
    },
    paint: {
      "line-width": [
        "match",
        ["get", "typeVeg"],
        "Motorveg",
        5,
        "Enkel bilveg",
        3,
        2
      ],
      "line-color": "#2563eb",
      "line-opacity": 0.7
    }
  });

  map.addLayer({
    id: "nvdb-roadnet-too-narrow",
    type: "line",
    source: "nvdb-roadnet",
    layout: {
      visibility: "none"
    },
    filter: ["all", ["has", "widthM"], ["<", ["get", "widthM"], 0]],
    paint: {
      "line-width": [
        "match",
        ["get", "typeVeg"],
        "Motorveg",
        6,
        "Enkel bilveg",
        4,
        3
      ],
      "line-color": "#dc2626",
      "line-opacity": 0.9
    }
  });

  map.addLayer({
    id: "nvdb-roadnet-too-low",
    type: "line",
    source: "nvdb-roadnet",
    layout: {
      visibility: "none"
    },
    filter: ["all", ["has", "clearanceM"], ["<", ["get", "clearanceM"], 0]],
    paint: {
      "line-width": [
        "match",
        ["get", "typeVeg"],
        "Motorveg",
        6,
        "Enkel bilveg",
        4,
        3
      ],
      "line-color": "#ef4444",
      "line-opacity": 0.9
    }
  });

  const handleRoadnetClick = (event) => {
    const feature = event.features?.[0];
    if (!feature) return;
    const { typeVeg, veglenkesekvensid, widthText, widthM, clearanceText, clearanceM } =
      feature.properties;

    const vehicleWidthText = Number.isFinite(vehicleWidthMeters)
      ? `${vehicleWidthMeters.toFixed(1)} m`
      : null;
    const roadWidthNumber = typeof widthM === "number" ? widthM : Number(widthM);
    const passable =
      Number.isFinite(vehicleWidthMeters) && Number.isFinite(roadWidthNumber)
        ? roadWidthNumber >= vehicleWidthMeters
        : null;

    const vehicleHeightText = Number.isFinite(vehicleHeightMeters)
      ? `${vehicleHeightMeters.toFixed(1)} m`
      : null;
    const roadClearanceNumber =
      typeof clearanceM === "number" ? clearanceM : Number(clearanceM);
    const passableHeight =
      Number.isFinite(vehicleHeightMeters) && Number.isFinite(roadClearanceNumber)
        ? roadClearanceNumber >= vehicleHeightMeters
        : null;

    new maplibregl.Popup()
      .setLngLat(event.lngLat)
      .setHTML(
        `<strong>Vegnett</strong><br/>Type: ${typeVeg || "Ukjent"}<br/>Veglenkesekvens: ${veglenkesekvensid || "?"}` +
          `<br/>Vegbredde (NVDB): ${widthText || "Ukjent"}` +
          `<br/>Høydebegrensning (NVDB): ${clearanceText || "Ukjent"}` +
          (vehicleWidthText
            ? `<br/>Kjøretøy: ${vehicleWidthText} → ${passable === null ? "ukjent" : passable ? "OK" : "FOR SMAL"}`
            : "")
          +
          (vehicleHeightText
            ? `<br/>Kjøretøyhøyde: ${vehicleHeightText} → ${passableHeight === null ? "ukjent" : passableHeight ? "OK" : "FOR LAV"}`
            : "")
      )
      .addTo(map);
  };

  map.on("click", "nvdb-roadnet-line", handleRoadnetClick);
  map.on("click", "nvdb-roadnet-too-narrow", handleRoadnetClick);
  map.on("click", "nvdb-roadnet-too-low", handleRoadnetClick);
}

function addNvdbHeightLayer() {
  map.addSource("nvdb-height", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] }
  });

  map.addLayer({
    id: "nvdb-height-line",
    type: "line",
    source: "nvdb-height",
    paint: {
      "line-width": 4,
      "line-color": "#ef4444",
      "line-opacity": 0.9
    }
  });

  map.on("click", "nvdb-height-line", (event) => {
    const feature = event.features?.[0];
    if (!feature) return;
    const { height, obstacleType } = feature.properties;
    new maplibregl.Popup()
      .setLngLat(event.lngLat)
      .setHTML(
        `<strong>Høydebegrensning</strong><br/>Type: ${obstacleType || "Ukjent"}<br/>Skilta høyde: ${height || "?"} m`
      )
      .addTo(map);
  });
}

function addNvdbWidthLayer() {
  map.addSource("nvdb-width", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] }
  });

  map.addLayer({
    id: "nvdb-width-line",
    type: "line",
    source: "nvdb-width",
    paint: {
      "line-width": 3,
      "line-color": "#8b5cf6",
      "line-opacity": 0.8
    }
  });

  map.on("click", "nvdb-width-line", (event) => {
    const feature = event.features?.[0];
    if (!feature) return;
    const { widthValue } = feature.properties;
    new maplibregl.Popup()
      .setLngLat(event.lngLat)
      .setHTML(
        `<strong>Vegbredde</strong><br/>Total: ${widthValue || "?"} m`
      )
      .addTo(map);
  });
}

function addNvdbWeightLayer() {
  map.addSource("nvdb-weight", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] }
  });

  map.addLayer({
    id: "nvdb-weight-line",
    type: "line",
    source: "nvdb-weight",
    paint: {
      "line-width": 3,
      "line-color": "#f59e0b",
      "line-opacity": 0.85
    }
  });

  map.on("click", "nvdb-weight-line", (event) => {
    const feature = event.features?.[0];
    if (!feature) return;
    const { className } = feature.properties;
    new maplibregl.Popup()
      .setLngLat(event.lngLat)
      .setHTML(
        `<strong>Bruksklasse</strong><br/>Klasse: ${className || "?"}`
      )
      .addTo(map);
  });

  // Rockslide check on map click
  map.on("click", async (event) => {
    // Only check rockslide if Supabase is configured and we're not clicking on an existing feature
    if (!supabase || !config.supabase.rockslide || event.features?.length > 0) {
      return;
    }
    setSelectedPointMarker(event.lngLat);
    await handleRockslideCheckAtPoint(event.lngLat);
  });
}


function parseLineString(wkt) {
  if (!wkt || !wkt.startsWith("LINESTRING")) return null;
  const start = wkt.indexOf("(");
  const end = wkt.lastIndexOf(")");
  if (start === -1 || end === -1) return null;
  const coordsText = wkt.slice(start + 1, end);
  const coords = coordsText.split(",").map((pair) => {
    const parts = pair.trim().split(/\s+/);
    // NVDB wkt i srid=4326 er vanligvis LAT LON, så vi snur til LON LAT.
    return [Number(parts[1]), Number(parts[0])];
  });
  return coords.length ? coords : null;
}

function normalizeNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  if (!text) return null;
  const normalized = text.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isLikelyWgs84LngLat(lng, lat) {
  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    Math.abs(lng) <= 180 &&
    Math.abs(lat) <= 90
  );
}

function toWgs84LngLat(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  if (isLikelyWgs84LngLat(x, y)) {
    return [x, y];
  }

  try {
    return convertUTM33toWGS84(x, y);
  } catch {
    return null;
  }
}

function representativeCoordFromGeometry(geometry) {
  if (!geometry || typeof geometry !== "object") return null;
  const coords = geometry.coordinates;
  if (!Array.isArray(coords)) return null;

  switch (geometry.type) {
    case "Point":
      return Array.isArray(coords) && coords.length >= 2 ? coords : null;
    case "LineString":
    case "MultiPoint":
      return lineMidpoint(coords);
    case "Polygon": {
      const ring = Array.isArray(coords[0]) ? coords[0] : null;
      return Array.isArray(ring) && ring.length ? ring[Math.floor(ring.length / 2)] : null;
    }
    case "MultiLineString": {
      const line = Array.isArray(coords[0]) ? coords[0] : null;
      return Array.isArray(line) && line.length ? line[Math.floor(line.length / 2)] : null;
    }
    case "MultiPolygon": {
      const ring = Array.isArray(coords[0]) && Array.isArray(coords[0][0]) ? coords[0][0] : null;
      return Array.isArray(ring) && ring.length ? ring[Math.floor(ring.length / 2)] : null;
    }
    default:
      return null;
  }
}

function normalizeRockslideCheckResult(result, radiusMeters) {
  if (typeof result === "boolean") {
    return {
      atRisk: result,
      count: result ? 1 : 0,
      nearestMeters: null,
      source: "rpc"
    };
  }

  if (Array.isArray(result) && result.length > 0 && typeof result[0] === "object" && result[0]) {
    const row = result[0];
    const atRisk =
      Boolean(row.at_risk) ||
      Boolean(row.is_at_risk) ||
      (Number.isFinite(Number(row.count)) && Number(row.count) > 0);
    const nearestMeters =
      Number(row.nearest_m ?? row.nearest_distance_m ?? row.min_distance_m);
    const count = Number(row.count ?? row.match_count ?? row.hits ?? 0);
    return {
      atRisk,
      count: Number.isFinite(count) ? count : atRisk ? 1 : 0,
      nearestMeters: Number.isFinite(nearestMeters) ? nearestMeters : null,
      source: "rpc"
    };
  }

  if (result && typeof result === "object") {
    const atRisk =
      Boolean(result.at_risk) ||
      Boolean(result.is_at_risk) ||
      (Number.isFinite(Number(result.count)) && Number(result.count) > 0);
    const nearestMeters = Number(result.nearest_m ?? result.nearest_distance_m ?? result.min_distance_m);
    const count = Number(result.count ?? result.match_count ?? result.hits ?? 0);
    return {
      atRisk,
      count: Number.isFinite(count) ? count : atRisk ? 1 : 0,
      nearestMeters: Number.isFinite(nearestMeters) ? nearestMeters : null,
      source: "rpc"
    };
  }

  return {
    atRisk: false,
    count: 0,
    nearestMeters: null,
    source: "rpc"
  };
}

function extractLngLatFromRow(row) {
  if (!row || typeof row !== "object") return null;

  const directLng = normalizeNumber(row.lng ?? row.lon ?? row.longitude ?? row.x);
  const directLat = normalizeNumber(row.lat ?? row.latitude ?? row.y);
  if (Number.isFinite(directLng) && Number.isFinite(directLat)) {
    const converted = toWgs84LngLat(directLng, directLat);
    if (converted) return converted;
  }

  const rawGeom = row.geom ?? row.geometry ?? row.geojson ?? row.omrade ?? row.grense;
  const geom = rawGeom?.type === "Feature" ? rawGeom.geometry : rawGeom;
  if (geom && typeof geom === "object") {
    const coord = representativeCoordFromGeometry(geom);
    if (Array.isArray(coord) && coord.length >= 2) {
      const x = Number(coord[0]);
      const y = Number(coord[1]);
      const converted = toWgs84LngLat(x, y);
      if (converted) return converted;
    }
  }

  return null;
}

async function checkRockslideRiskNearPoint(lngLat) {
  const radiusMeters = config.supabase.rockslide.radiusMeters;
  const schemaCandidates =
    config.supabase.rockslide.schemaCandidates?.length
      ? config.supabase.rockslide.schemaCandidates
      : ["public"];
  const requirePostgisRpc = config.supabase.rockslide.requirePostgisRpc !== false;

  if (!supabase) {
    throw new Error("Supabase er ikke konfigurert.");
  }

  const [lng, lat] = lngLat;

  const schemaClient = (schemaName) =>
    schemaName === "public" || typeof supabase.schema !== "function"
      ? supabase
      : supabase.schema(schemaName);
  const rockslideTypeKeywords = (config.supabase.rockslide.rockslideTypeKeywords || []).map((word) =>
    String(word || "").toLowerCase().trim()
  );

  let lastError = null;
  for (const schemaName of schemaCandidates) {
    const { data: rpcData, error: rpcError } = await schemaClient(schemaName).rpc(
      config.supabase.rockslide.rpcName,
      {
        p_lng: lng,
        p_lat: lat,
        p_radius_m: radiusMeters
      }
    );

    if (!rpcError) {
      const result = normalizeRockslideCheckResult(rpcData, radiusMeters);
      result.source = `rpc:${schemaName}.${config.supabase.rockslide.rpcName}`;
      return result;
    }

    lastError = rpcError;
  }

  if (requirePostgisRpc) {
    throw new Error(
      `Mangler RPC for PostGIS. Opprett ${schemaCandidates[0]}.${config.supabase.rockslide.rpcName} med ST_DWithin for 1 km-sjekk.`
    );
  }

  for (const schemaName of schemaCandidates) {
    for (const tableName of config.supabase.rockslide.tableCandidates) {
      const { data, error } = await schemaClient(schemaName)
        .from(tableName)
        .select("*")
        .limit(5000);
      if (error) {
        lastError = error;
        continue;
      }

      const scopedRows = (data || []).filter((row) => {
        if (!rockslideTypeKeywords.length) return true;
        const typeText = String(row?.skredtype ?? row?.objtype ?? "").toLowerCase();
        if (!typeText) return true;
        return rockslideTypeKeywords.some((keyword) => typeText.includes(keyword));
      });

      const matches = [];
      let nearestMeters = Infinity;
      let rowsWithGeometryWithoutPoint = 0;
      for (const row of scopedRows) {
        const targetPoint = extractLngLatFromRow(row);
        if (!targetPoint) {
          if (row?.omrade || row?.grense || row?.geom || row?.geometry) {
            rowsWithGeometryWithoutPoint += 1;
          }
          continue;
        }
        const distMeters = haversineMeters(lngLat, targetPoint);
        if (distMeters <= radiusMeters) {
          matches.push(row);
          nearestMeters = Math.min(nearestMeters, distMeters);
        }
      }

      if (!matches.length && rowsWithGeometryWithoutPoint > 0) {
        throw new Error(
          `Tabellen ${schemaName}.${tableName} inneholder geometri som ikke kunne tolkes til punkt (selv etter 25833→4326-konvertering). Lag eller bruk RPC ${schemaName}.${config.supabase.rockslide.rpcName} for presis avstandssjekk.`
        );
      }

      return {
        atRisk: matches.length > 0,
        count: matches.length,
        nearestMeters: Number.isFinite(nearestMeters) ? nearestMeters : null,
        source: `table:${schemaName}.${tableName}`
      };
    }
  }

  throw new Error(
    lastError?.message ||
      "Fant ikke gyldig RPC eller tabell for steinskreddata i skredfaresoner/public."
  );
}

async function handleRockslideCheckAtPoint(lngLat) {
  const statusEl = document.getElementById("rockslide-status");
  const currentRequestId = ++rockslideRequestId;
  if (statusEl) {
    statusEl.textContent = "Sjekker steinskredfare innen 1 km...";
  }

  try {
    const result = await checkRockslideRiskNearPoint([lngLat.lng, lngLat.lat]);
    if (currentRequestId !== rockslideRequestId) return;

    const nearestText = Number.isFinite(result.nearestMeters)
      ? ` Nærmeste funn: ${result.nearestMeters.toFixed(0)} m.`
      : "";

    const message = result.atRisk
      ? `Risiko funnet innen 1 km (${result.count} treff).${nearestText}`
      : "Ingen registrert steinskredrisiko innen 1 km.";

    if (statusEl) {
      statusEl.textContent = message;
    }

    new maplibregl.Popup()
      .setLngLat(lngLat)
      .setHTML(
        `<strong>Steinskred-sjekk</strong><br/>${message}<br/>Kilde: ${result.source}`
      )
      .addTo(map);
  } catch (error) {
    if (currentRequestId !== rockslideRequestId) return;
    if (statusEl) {
      statusEl.textContent = `Feil i steinskredsjekk: ${error.message}`;
    }
    new maplibregl.Popup()
      .setLngLat(lngLat)
      .setHTML(`<strong>Steinskred-sjekk</strong><br/>Feil: ${error.message}`)
      .addTo(map);
  }
}

function haversineMeters(aLngLat, bLngLat) {
  const [lon1, lat1] = aLngLat;
  const [lon2, lat2] = bLngLat;
  if (![lon1, lat1, lon2, lat2].every((n) => Number.isFinite(n))) return Infinity;

  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(phi1) * Math.cos(phi2) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function lineMidpoint(coords) {
  if (!Array.isArray(coords) || coords.length === 0) return null;
  return coords[Math.floor(coords.length / 2)] ?? null;
}

function buildSpatialIndex(points, cellSizeDegrees) {
  const index = new Map();
  const cellKey = (lon, lat) => {
    const x = Math.floor(lon / cellSizeDegrees);
    const y = Math.floor(lat / cellSizeDegrees);
    return `${x}:${y}`;
  };

  for (const point of points) {
    const [lon, lat] = point.mid;
    const key = cellKey(lon, lat);
    const bucket = index.get(key);
    if (bucket) bucket.push(point);
    else index.set(key, [point]);
  }

  return { index, cellKey };
}

function attachWidthToRoadnet(roadnet, widthLayer) {
  if (!roadnet?.features?.length || !widthLayer?.features?.length) return;

  const widthPoints = [];
  for (const feature of widthLayer.features) {
    const coords = feature?.geometry?.coordinates;
    const mid = lineMidpoint(coords);
    if (!mid) continue;
    const widthM = normalizeNumber(feature?.properties?.widthValue);
    if (!Number.isFinite(widthM)) continue;
    widthPoints.push({ mid, widthM });
  }

  if (!widthPoints.length) return;

  const cellSizeDegrees = 0.01;
  const { index, cellKey } = buildSpatialIndex(widthPoints, cellSizeDegrees);
  const maxMatchMeters = 75;

  for (const feature of roadnet.features) {
    const coords = feature?.geometry?.coordinates;
    const mid = lineMidpoint(coords);
    if (!mid) continue;

    const [lon, lat] = mid;
    const baseKey = cellKey(lon, lat);
    const [baseXText, baseYText] = baseKey.split(":");
    const baseX = Number(baseXText);
    const baseY = Number(baseYText);

    let best = null;
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const key = `${baseX + dx}:${baseY + dy}`;
        const bucket = index.get(key);
        if (!bucket) continue;
        for (const candidate of bucket) {
          const dist = haversineMeters(mid, candidate.mid);
          if (dist > maxMatchMeters) continue;
          if (!best || dist < best.dist) {
            best = { dist, widthM: candidate.widthM };
          }
        }
      }
    }

    if (best) {
      feature.properties = feature.properties || {};
      feature.properties.widthM = best.widthM;
      feature.properties.widthText = `${best.widthM.toFixed(1)} m`;
    }
  }
}

function attachHeightToRoadnet(roadnet, heightLayer) {
  if (!roadnet?.features?.length || !heightLayer?.features?.length) return;

  const heightPoints = [];
  for (const feature of heightLayer.features) {
    const coords = feature?.geometry?.coordinates;
    const mid = lineMidpoint(coords);
    if (!mid) continue;
    const clearanceM = normalizeNumber(feature?.properties?.height);
    if (!Number.isFinite(clearanceM)) continue;
    heightPoints.push({ mid, clearanceM });
  }

  if (!heightPoints.length) return;

  const cellSizeDegrees = 0.01;
  const { index, cellKey } = buildSpatialIndex(heightPoints, cellSizeDegrees);
  const maxMatchMeters = 75;

  for (const feature of roadnet.features) {
    const coords = feature?.geometry?.coordinates;
    const mid = lineMidpoint(coords);
    if (!mid) continue;

    const [lon, lat] = mid;
    const baseKey = cellKey(lon, lat);
    const [baseXText, baseYText] = baseKey.split(":");
    const baseX = Number(baseXText);
    const baseY = Number(baseYText);

    let best = null;
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const key = `${baseX + dx}:${baseY + dy}`;
        const bucket = index.get(key);
        if (!bucket) continue;
        for (const candidate of bucket) {
          const dist = haversineMeters(mid, candidate.mid);
          if (dist > maxMatchMeters) continue;
          if (!best || dist < best.dist) {
            best = { dist, clearanceM: candidate.clearanceM };
          }
        }
      }
    }

    if (best) {
      feature.properties = feature.properties || {};
      feature.properties.clearanceM = best.clearanceM;
      feature.properties.clearanceText = `${best.clearanceM.toFixed(1)} m`;
    }
  }
}

function updateVehicleWidthFilters() {
  if (
    !map.getLayer("nvdb-roadnet-line") ||
    !map.getLayer("nvdb-roadnet-too-narrow") ||
    !map.getLayer("nvdb-roadnet-too-low")
  ) {
    return;
  }

  const visible = ["all"];

  if (Number.isFinite(vehicleWidthMeters)) {
    visible.push(["has", "widthM"]);
    if (hideTooNarrowRoads) {
      visible.push([">=", ["get", "widthM"], vehicleWidthMeters]);
    }
  }

  if (Number.isFinite(vehicleHeightMeters)) {
    if (hideTooLowRoads) {
      visible.push([
        "any",
        ["!", ["has", "clearanceM"]],
        [">=", ["get", "clearanceM"], vehicleHeightMeters]
      ]);
    }
  }

  const visibleFilter = visible.length > 1 ? visible : null;
  map.setFilter("nvdb-roadnet-line", visibleFilter);

  if (!Number.isFinite(vehicleWidthMeters) || hideTooNarrowRoads) {
    map.setFilter("nvdb-roadnet-too-narrow", ["all", ["has", "widthM"], ["<", ["get", "widthM"], 0]]);
  } else {
    map.setFilter("nvdb-roadnet-too-narrow", [
      "all",
      ...(visibleFilter ? visibleFilter.slice(1) : []),
      ["<", ["get", "widthM"], vehicleWidthMeters]
    ]);
  }

  if (!Number.isFinite(vehicleHeightMeters) || hideTooLowRoads) {
    map.setFilter("nvdb-roadnet-too-low", ["all", ["has", "clearanceM"], ["<", ["get", "clearanceM"], 0]]);
  } else {
    map.setFilter("nvdb-roadnet-too-low", [
      "all",
      ...(visibleFilter ? visibleFilter.slice(1) : []),
      ["has", "clearanceM"],
      ["<", ["get", "clearanceM"], vehicleHeightMeters]
    ]);
  }
}

function getBoundsBbox() {
  const bounds = map.getBounds();
  const west = bounds.getWest().toFixed(4);
  const south = bounds.getSouth().toFixed(4);
  const east = bounds.getEast().toFixed(4);
  const north = bounds.getNorth().toFixed(4);
  return `${west},${south},${east},${north}`;
}

async function fetchNvdbRoadnet(bbox, requestId) {
  const url = `${config.nvdb.baseUrl}${config.nvdb.roadnetPath}?srid=4326&kartutsnitt=${bbox}&antall=${config.nvdb.maxFeatures}`;
  const response = await fetch(url);
  if (!response.ok) {
    console.error("NVDB vegnett feil", response.status, response.statusText);
    return null;
  }
  const data = await response.json();
  if (requestId !== nvdbRequestId) return null;

  const features = [];
  for (const obj of data.objekter || []) {
    const sequenceId = obj.veglenkesekvensid;
    for (const link of obj.veglenker || []) {
      const coords = parseLineString(link.geometri?.wkt);
      if (!coords) continue;
      features.push({
        type: "Feature",
        properties: {
          typeVeg: link.typeVeg || "Ukjent",
          veglenkesekvensid: sequenceId
        },
        geometry: {
          type: "LineString",
          coordinates: coords
        }
      });
    }
  }
  return { type: "FeatureCollection", features };
}

async function fetchNvdbHeight(bbox, requestId) {
  const url = `${config.nvdb.baseUrl}${config.nvdb.heightPath}?srid=4326&kartutsnitt=${bbox}&antall=${config.nvdb.maxFeatures}&inkluder=egenskaper,geometri`;
  const response = await fetch(url);
  if (!response.ok) {
    console.error("NVDB høyde feil", response.status, response.statusText);
    return null;
  }
  const data = await response.json();
  if (requestId !== nvdbRequestId) return null;

  const features = [];
  for (const obj of data.objekter || []) {
    const coords = parseLineString(obj.geometri?.wkt);
    if (!coords) continue;
    const props = obj.egenskaper || [];
    const heightProp = props.find((item) => item.navn?.toLowerCase().includes("høyde"));
    const obstacleProp = props.find((item) => item.navn === "Type hinder");
    features.push({
      type: "Feature",
      properties: {
        height: heightProp?.verdi ?? null,
        obstacleType: obstacleProp?.verdi ?? null
      },
      geometry: {
        type: "LineString",
        coordinates: coords
      }
    });
  }
  return { type: "FeatureCollection", features };
}

async function fetchNvdbWidth(bbox, requestId) {
  const url = `${config.nvdb.baseUrl}${config.nvdb.widthPath}?srid=4326&kartutsnitt=${bbox}&antall=${config.nvdb.maxFeatures}&inkluder=egenskaper,geometri`;
  const response = await fetch(url);
  if (!response.ok) {
    console.error("NVDB vegbredde feil", response.status, response.statusText);
    return null;
  }
  const data = await response.json();
  if (requestId !== nvdbRequestId) return null;

  const features = [];
  for (const obj of data.objekter || []) {
    const coords = parseLineString(obj.geometri?.wkt);
    if (!coords) continue;
    const props = obj.egenskaper || [];
    const widthProp = props.find((item) => item.navn?.toLowerCase().includes("bredde"));
    const widthValue = widthProp?.verdi ?? null;
    features.push({
      type: "Feature",
      properties: {
        widthValue
      },
      geometry: {
        type: "LineString",
        coordinates: coords
      }
    });
  }
  return { type: "FeatureCollection", features };
}

async function fetchNvdbWeight(bbox, requestId) {
  const url = `${config.nvdb.baseUrl}${config.nvdb.weightPath}?srid=4326&kartutsnitt=${bbox}&antall=${config.nvdb.maxFeatures}&inkluder=egenskaper,geometri`;
  const response = await fetch(url);
  if (!response.ok) {
    console.error("NVDB bruksklasse feil", response.status, response.statusText);
    return null;
  }
  const data = await response.json();
  if (requestId !== nvdbRequestId) return null;

  const features = [];
  for (const obj of data.objekter || []) {
    const coords = parseLineString(obj.geometri?.wkt);
    if (!coords) continue;
    const props = obj.egenskaper || [];
    const classProp = props.find((item) => item.navn?.toLowerCase().includes("bruksklasse"));
    features.push({
      type: "Feature",
      properties: {
        className: classProp?.verdi ?? null
      },
      geometry: {
        type: "LineString",
        coordinates: coords
      }
    });
  }
  return { type: "FeatureCollection", features };
}

async function refreshNvdbData() {
  if (map.getZoom() < config.nvdb.minZoom) {
    map.getSource("nvdb-roadnet").setData({ type: "FeatureCollection", features: [] });
    map.getSource("nvdb-height").setData({ type: "FeatureCollection", features: [] });
    map.getSource("nvdb-width").setData({ type: "FeatureCollection", features: [] });
    map.getSource("nvdb-weight").setData({ type: "FeatureCollection", features: [] });
    return;
  }

  nvdbRequestId += 1;
  const requestId = nvdbRequestId;
  const bbox = getBoundsBbox();

  let width = null;
  let roadnetResult = null;
  let height = null;
  let weight = null;
  try {
    width = await fetchNvdbWidth(bbox, requestId);
    [roadnetResult, height, weight] = await Promise.all([
      fetchNvdbRoadnet(bbox, requestId),
      fetchNvdbHeight(bbox, requestId),
      fetchNvdbWeight(bbox, requestId)
    ]);
  } catch (error) {
    console.error("NVDB fetch feil", error);
    return;
  }

  if (roadnetResult) {
    if (width) {
      attachWidthToRoadnet(roadnetResult, width);
    }
    if (height) {
      attachHeightToRoadnet(roadnetResult, height);
    }
    map.getSource("nvdb-roadnet").setData(roadnetResult);
    updateVehicleWidthFilters();
  }
  if (height) {
    map.getSource("nvdb-height").setData(height);
  }
  if (width) {
    map.getSource("nvdb-width").setData(width);
  }
  if (weight) {
    map.getSource("nvdb-weight").setData(weight);
  }

}

function scheduleNvdbFetch() {
  if (nvdbFetchTimer) {
    window.clearTimeout(nvdbFetchTimer);
  }
  nvdbFetchTimer = window.setTimeout(() => {
    refreshNvdbData();
  }, 350);
}

map.on("moveend", () => {
  scheduleNvdbFetch();
});

const toggleRoadnet = document.getElementById("toggle-roadnet");
const toggleElveg = document.getElementById("toggle-elveg");
const toggleHeight = document.getElementById("toggle-height");
const toggleWidth = document.getElementById("toggle-width");
const toggleWeight = document.getElementById("toggle-weight");
const loadSupabase = document.getElementById("load-supabase");
const vehicleWidthInput = document.getElementById("vehicle-width");
const vehicleHeightInput = document.getElementById("vehicle-height");
const hideTooNarrowToggle = document.getElementById("toggle-hide-too-narrow");
const hideTooLowToggle = document.getElementById("toggle-hide-too-low");

hideTooNarrowRoads = Boolean(hideTooNarrowToggle?.checked);
hideTooLowRoads = Boolean(hideTooLowToggle?.checked);

toggleElveg.addEventListener("change", (event) => {
  const visibility = event.target.checked ? "visible" : "none";
  if (map.getLayer("elveg-wms-layer")) {
    map.setLayoutProperty("elveg-wms-layer", "visibility", visibility);
  }
});

toggleRoadnet.addEventListener("change", (event) => {
  const visibility = event.target.checked ? "visible" : "none";
  if (map.getLayer("nvdb-roadnet-line")) {
    map.setLayoutProperty("nvdb-roadnet-line", "visibility", visibility);
  }
  if (map.getLayer("nvdb-roadnet-too-narrow")) {
    map.setLayoutProperty("nvdb-roadnet-too-narrow", "visibility", visibility);
  }
  if (map.getLayer("nvdb-roadnet-too-low")) {
    map.setLayoutProperty("nvdb-roadnet-too-low", "visibility", visibility);
  }
});

toggleHeight.addEventListener("change", (event) => {
  const visibility = event.target.checked ? "visible" : "none";
  if (map.getLayer("nvdb-height-line")) {
    map.setLayoutProperty("nvdb-height-line", "visibility", visibility);
  }
});

toggleWidth.addEventListener("change", (event) => {
  const visibility = event.target.checked ? "visible" : "none";
  if (map.getLayer("nvdb-width-line")) {
    map.setLayoutProperty("nvdb-width-line", "visibility", visibility);
  }
});

toggleWeight.addEventListener("change", (event) => {
  const visibility = event.target.checked ? "visible" : "none";
  if (map.getLayer("nvdb-weight-line")) {
    map.setLayoutProperty("nvdb-weight-line", "visibility", visibility);
  }
});

if (config.supabase.url && config.supabase.key) {
  loadSupabase.disabled = false;
  const statusEl = document.getElementById("supabase-status");
  if (statusEl) statusEl.textContent = "Klar til å laste data";
} else {
  const statusEl = document.getElementById("supabase-status");
  if (statusEl) {
    statusEl.textContent = "Mangler Supabase-konfigurasjon. Kopier web/.env.example til web/.env";
  }
}

loadSupabase.addEventListener("click", async () => {
  if (!supabase) {
    alert("Supabase ikke konfigurert. Sjekk .env filen.");
    return;
  }
  
  const statusEl = document.getElementById("supabase-status");
  const toggleRoadSegments = document.getElementById("toggle-road-segments");
  const toggleTunnels = document.getElementById("toggle-tunnels");
  const toggleVehicleDetails = document.getElementById("toggle-vehicle-details");
  
  // Sjekk hvilke som er valgt
  const shouldFetchRoadSegments = toggleRoadSegments?.checked;
  const shouldFetchTunnels = toggleTunnels?.checked;
  const shouldFetchVehicleDetails = toggleVehicleDetails?.checked;
  
  if (!shouldFetchRoadSegments && !shouldFetchTunnels && !shouldFetchVehicleDetails) {
    alert("Velg minst en datasource: Vegsegmenter, Tunneler eller Kjøretøy detaljer");
    return;
  }
  
  try {
    if (statusEl) statusEl.textContent = "Henter data...";
    
    let roadData = null;
    let tunnelData = null;
    let vehicleData = null;
    
    // Hent data fra road_segments hvis valgt
    if (shouldFetchRoadSegments) {
      const { data, error } = await supabase
        .from('road_segments')
        .select('*')
        .limit(50);
      if (error) throw new Error(`Road segments: ${error.message}`);
      roadData = data;
    }
    
    // Hent data fra tunnels hvis valgt
    if (shouldFetchTunnels) {
      const { data, error } = await supabase
        .from('tunnels')
        .select('*')
        .limit(50);
      if (error) throw new Error(`Tunnels: ${error.message}`);
      tunnelData = data;
    }
    
    // Hent data fra kjøretøy detaljer hvis valgt
    if (shouldFetchVehicleDetails) {
      const tableCandidates = ["Kjoretoy_detaljer", "kjoretoy_detaljer"];
      let selectedTable = null;
      let lastError = null;
      
      for (const tableName of tableCandidates) {
        const { data, error } = await supabase.from(tableName).select("*").limit(50);
        if (!error) {
          selectedTable = tableName;
          vehicleData = data || [];
          break;
        }
        lastError = error;
      }
      
      if (!selectedTable) {
        throw lastError || new Error("Fant ikke tabellen Kjoretoy_detaljer.");
      }
    }
    
    // Supabase data loaded successfully
    
    const results = [];
    if (shouldFetchRoadSegments) results.push(`${roadData?.length || 0} vegsegmenter`);
    if (shouldFetchTunnels) results.push(`${tunnelData?.length || 0} tunneler`);
    if (shouldFetchVehicleDetails) results.push(`${vehicleData?.length || 0} kjøretøy`);
    
    if (statusEl) {
      statusEl.textContent = `✓ Tilkoblet! ${results.join(", ")}`;
    }
    
    alert(`Supabase fungerer!\n\n${results.join("\n")}\n\nSe konsollen for detaljer.`);
    
  } catch (err) {
    console.error('Feil ved henting fra Supabase:', err);
    if (statusEl) statusEl.textContent = `✗ Feil: ${err.message}`;
    alert(`Feil ved tilkobling til Supabase:\n${err.message}`);
  }
});

vehicleWidthInput?.addEventListener("input", (event) => {
  const value = normalizeNumber(event.target.value);
  vehicleWidthMeters = Number.isFinite(value) ? value : null;
  updateVehicleWidthFilters();
});

vehicleHeightInput?.addEventListener("input", (event) => {
  const value = normalizeNumber(event.target.value);
  vehicleHeightMeters = Number.isFinite(value) ? value : null;
  updateVehicleWidthFilters();
});

hideTooNarrowToggle?.addEventListener("change", (event) => {
  hideTooNarrowRoads = Boolean(event.target.checked);
  updateVehicleWidthFilters();
});

hideTooLowToggle?.addEventListener("change", (event) => {
  hideTooLowRoads = Boolean(event.target.checked);
  updateVehicleWidthFilters();
});
