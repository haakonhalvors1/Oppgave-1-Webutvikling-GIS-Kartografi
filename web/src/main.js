import maplibregl from "maplibre-gl";
import "./style.css";

const config = {
  baseStyle: "https://demotiles.maplibre.org/style.json",
  staticGeoJson: "/data/sample.geojson",
  externalOgcUrl: import.meta.env.VITE_EXTERNAL_OGC_URL,
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL,
    key: import.meta.env.VITE_SUPABASE_KEY
  }
};

const root = document.getElementById("app");
root.innerHTML = `
  <aside class="panel">
    <p class="badge">Oppgave 1 • GIS</p>
    <h1>Webkart-template</h1>
    <p>Fyll inn dine datasett, OGC-endepunkt og (valgfritt) Supabase-tilkobling. Kjør via Docker for lokal utvikling.</p>

    <section>
      <h3>Lagstyring</h3>
      <div class="layer-list">
        <label class="control-row">
          <input type="checkbox" id="toggle-static" checked /> Statisk GeoJSON
        </label>
        <label class="control-row">
          <input type="checkbox" id="toggle-ogc" checked /> Eksternt OGC-lag
        </label>
      </div>
      <p class="note">Erstatt kildene i <code>config</code> for dine datasett.</p>
    </section>

    <section>
      <h3>Filter (attributt)</h3>
      <div class="control-row">
        <label for="value-min">Min. verdi</label>
        <input id="value-min" type="number" min="0" step="1" value="0" style="width: 100px;" />
        <button id="apply-filter">Bruk filter</button>
      </div>
      <p class="note">Bytt ut med din egen romlige eller SQL-baserte spørring.</p>
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
  center: [10.75, 59.91],
  zoom: 10
});

map.addControl(new maplibregl.NavigationControl(), "top-right");

map.on("load", () => {
  addStaticGeoJsonLayer();
  addExternalOgcLayer();
});

function addStaticGeoJsonLayer() {
  map.addSource("static-geojson", {
    type: "geojson",
    data: config.staticGeoJson
  });

  map.addLayer({
    id: "static-points",
    type: "circle",
    source: "static-geojson",
    paint: {
      "circle-radius": 8,
      "circle-color": [
        "match",
        ["get", "category"],
        "A",
        "#2563eb",
        "B",
        "#10b981",
        "#f97316"
      ],
      "circle-stroke-color": "#0f172a",
      "circle-stroke-width": 1.5,
      "circle-opacity": 0.9
    }
  });

  map.addLayer({
    id: "static-labels",
    type: "symbol",
    source: "static-geojson",
    layout: {
      "text-field": ["get", "name"],
      "text-offset": [0, 1.2],
      "text-anchor": "top",
      "text-size": 12
    },
    paint: {
      "text-color": "#0f172a",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1
    }
  });

  map.on("click", "static-points", (event) => {
    const feature = event.features?.[0];
    if (!feature) return;
    const { name, category, value } = feature.properties;
    new maplibregl.Popup()
      .setLngLat(event.lngLat)
      .setHTML(
        `<strong>${name}</strong><br/>Kategori: ${category}<br/>Verdi: ${value}`
      )
      .addTo(map);
  });
}

function addExternalOgcLayer() {
  // Placeholder raster OGC (WMS/WMTS). Replace with your endpoint & params.
  map.addSource("external-ogc", {
    type: "raster",
    tiles: [
      `${config.externalOgcUrl}?service=WMS&request=GetMap&layers=example&styles=&format=image/png&transparent=true&version=1.1.1&width=256&height=256&srs=EPSG:3857&bbox={bbox-epsg-3857}`
    ],
    tileSize: 256,
    attribution: "Eksternt OGC"
  });

  map.addLayer({
    id: "external-ogc-layer",
    type: "raster",
    source: "external-ogc",
    paint: { "raster-opacity": 0.8 }
  });
}

const toggleStatic = document.getElementById("toggle-static");
const toggleOgc = document.getElementById("toggle-ogc");
const valueMin = document.getElementById("value-min");
const applyFilter = document.getElementById("apply-filter");
const loadSupabase = document.getElementById("load-supabase");

applyFilter.addEventListener("click", () => {
  const min = Number(valueMin.value) || 0;
  map.setFilter("static-points", [">=", ["get", "value"], min]);
  map.setFilter("static-labels", [">=", ["get", "value"], min]);
});

toggleStatic.addEventListener("change", (event) => {
  const visibility = event.target.checked ? "visible" : "none";
  map.setLayoutProperty("static-points", "visibility", visibility);
  map.setLayoutProperty("static-labels", "visibility", visibility);
});

toggleOgc.addEventListener("change", (event) => {
  const visibility = event.target.checked ? "visible" : "none";
  map.setLayoutProperty("external-ogc-layer", "visibility", visibility);
});

if (config.supabase.url && config.supabase.key) {
  loadSupabase.disabled = false;
}

loadSupabase.addEventListener("click", () => {
  alert("Supabase-henting ikke implementert ennå. Koble Supabase JS og legg til en kilde.");
});
