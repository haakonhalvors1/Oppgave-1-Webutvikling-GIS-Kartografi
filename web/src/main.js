import maplibregl from "maplibre-gl";
import "./style.css";

const config = {
  baseStyle: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
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
      <h3>Lagstyring</h3>
      <div class="layer-list">
        <label class="control-row">
          <input type="checkbox" id="toggle-roadnet" checked /> NVDB vegnett
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
      <p class="note" id="nvdb-status">NVDB: venter...</p>
    </section>

    <section>
      <h3>Tegnforklaring</h3>
      <div class="legend">
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
  addNvdbRoadnetLayer();
  addNvdbHeightLayer();
  addNvdbWidthLayer();
  addNvdbWeightLayer();
  scheduleNvdbFetch();
});

let nvdbFetchTimer;
let nvdbRequestId = 0;

function addNvdbRoadnetLayer() {
  map.addSource("nvdb-roadnet", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] }
  });

  map.addLayer({
    id: "nvdb-roadnet-line",
    type: "line",
    source: "nvdb-roadnet",
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

  map.on("click", "nvdb-roadnet-line", (event) => {
    const feature = event.features?.[0];
    if (!feature) return;
    const { typeVeg, veglenkesekvensid } = feature.properties;
    new maplibregl.Popup()
      .setLngLat(event.lngLat)
      .setHTML(
        `<strong>Vegnett</strong><br/>Type: ${typeVeg || "Ukjent"}<br/>Veglenkesekvens: ${veglenkesekvensid || "?"}`
      )
      .addTo(map);
  });
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
  const statusEl = document.getElementById("nvdb-status");
  if (map.getZoom() < config.nvdb.minZoom) {
    map.getSource("nvdb-roadnet").setData({ type: "FeatureCollection", features: [] });
    map.getSource("nvdb-height").setData({ type: "FeatureCollection", features: [] });
    map.getSource("nvdb-width").setData({ type: "FeatureCollection", features: [] });
    map.getSource("nvdb-weight").setData({ type: "FeatureCollection", features: [] });
    if (statusEl) {
      statusEl.textContent = "NVDB: zoom inn for data.";
    }
    return;
  }

  nvdbRequestId += 1;
  const requestId = nvdbRequestId;
  const bbox = getBoundsBbox();

  if (statusEl) {
    statusEl.textContent = "NVDB: laster...";
  }

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
    if (statusEl) {
      statusEl.textContent = "NVDB: feil ved henting (se konsoll).";
    }
    return;
  }

  if (roadnetResult) {
    map.getSource("nvdb-roadnet").setData(roadnetResult);
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

  if (statusEl) {
    statusEl.textContent = `NVDB: vegnett ${roadnetResult?.features?.length ?? 0}, høyde ${height?.features?.length ?? 0}, bredde ${width?.features?.length ?? 0}, vekt ${weight?.features?.length ?? 0}.`;
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
const toggleHeight = document.getElementById("toggle-height");
const toggleWidth = document.getElementById("toggle-width");
const toggleWeight = document.getElementById("toggle-weight");
const loadSupabase = document.getElementById("load-supabase");

toggleRoadnet.addEventListener("change", (event) => {
  const visibility = event.target.checked ? "visible" : "none";
  if (map.getLayer("nvdb-roadnet-line")) {
    map.setLayoutProperty("nvdb-roadnet-line", "visibility", visibility);
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
