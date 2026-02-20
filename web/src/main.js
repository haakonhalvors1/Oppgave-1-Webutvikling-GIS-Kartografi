import maplibregl from "maplibre-gl";
import "./style.css";

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
    url: import.meta.env.VITE_SUPABASE_URL,
    key: import.meta.env.VITE_SUPABASE_KEY
  }
};

const root = document.getElementById("app");
root.innerHTML = `
  <aside class="panel">
    <p class="badge">Oppgave 1 • GIS</p>
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
          <input type="checkbox" id="toggle-hide-too-narrow" /> Skjul veier som er for smale
        </label>
      </div>
      <p class="note">Krever NVDB vegbredde (objekt 838). Ukjent bredde vises fortsatt.</p>
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
      <h3>Supabase (valgfritt)</h3>
      <button id="load-supabase" disabled>Hent fra Supabase</button>
      <p class="note">Aktiver ved å sette <code>VITE_SUPABASE_URL</code> og <code>VITE_SUPABASE_KEY</code>.</p>
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

  const handleRoadnetClick = (event) => {
    const feature = event.features?.[0];
    if (!feature) return;
    const { typeVeg, veglenkesekvensid, widthText, widthM } = feature.properties;

    const vehicleWidthText = Number.isFinite(vehicleWidthMeters)
      ? `${vehicleWidthMeters.toFixed(1)} m`
      : null;
    const roadWidthNumber = typeof widthM === "number" ? widthM : Number(widthM);
    const passable =
      Number.isFinite(vehicleWidthMeters) && Number.isFinite(roadWidthNumber)
        ? roadWidthNumber >= vehicleWidthMeters
        : null;

    new maplibregl.Popup()
      .setLngLat(event.lngLat)
      .setHTML(
        `<strong>Vegnett</strong><br/>Type: ${typeVeg || "Ukjent"}<br/>Veglenkesekvens: ${veglenkesekvensid || "?"}` +
          `<br/>Vegbredde (NVDB): ${widthText || "Ukjent"}` +
          (vehicleWidthText
            ? `<br/>Kjøretøy: ${vehicleWidthText} → ${passable === null ? "ukjent" : passable ? "OK" : "FOR SMAL"}`
            : "")
      )
      .addTo(map);
  };

  map.on("click", "nvdb-roadnet-line", handleRoadnetClick);
  map.on("click", "nvdb-roadnet-too-narrow", handleRoadnetClick);
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

function updateVehicleWidthFilters() {
  if (!map.getLayer("nvdb-roadnet-line") || !map.getLayer("nvdb-roadnet-too-narrow")) {
    return;
  }

  if (!Number.isFinite(vehicleWidthMeters)) {
    map.setFilter("nvdb-roadnet-too-narrow", ["all", ["has", "widthM"], ["<", ["get", "widthM"], 0]]);
    map.setFilter("nvdb-roadnet-line", null);
    return;
  }

  map.setFilter("nvdb-roadnet-too-narrow", [
    "all",
    ["has", "widthM"],
    ["<", ["get", "widthM"], vehicleWidthMeters]
  ]);

  if (hideTooNarrowRoads) {
    map.setFilter("nvdb-roadnet-line", ["all", ["has", "widthM"], [">=", ["get", "widthM"], vehicleWidthMeters]]);
  } else {
    map.setFilter("nvdb-roadnet-line", ["has", "widthM"]);
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
const hideTooNarrowToggle = document.getElementById("toggle-hide-too-narrow");

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
}

loadSupabase.addEventListener("click", () => {
  alert("Supabase-henting ikke implementert ennå. Koble Supabase JS og legg til en kilde.");
});

vehicleWidthInput?.addEventListener("input", (event) => {
  const value = normalizeNumber(event.target.value);
  vehicleWidthMeters = Number.isFinite(value) ? value : null;
  updateVehicleWidthFilters();
});

hideTooNarrowToggle?.addEventListener("change", (event) => {
  hideTooNarrowRoads = Boolean(event.target.checked);
  updateVehicleWidthFilters();
});
