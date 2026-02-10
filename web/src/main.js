import maplibregl from "maplibre-gl";
import "./style.css";

const config = {
  baseStyle: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  staticGeoJson: "/data/norway_restrictions.geojson",
  externalOgcUrl:
    import.meta.env.VITE_EXTERNAL_OGC_URL ||
    "https://wms.geonorge.no/skwms1/wms.vegnett2",
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
    <p>Viser alle veier via eksternt OGC-lag og filtrerer bort uegnede veier basert på kjøretøyets krav.</p>

    <section>
      <h3>Lagstyring</h3>
      <div class="layer-list">
        <label class="control-row">
          <input type="checkbox" id="toggle-static" checked /> Statisk GeoJSON
        </label>
        <label class="control-row">
          <input type="checkbox" id="toggle-ogc" checked /> Kartverket Vegnett (WMS)
        </label>
      </div>
      <p class="note">OGC-laget viser alle veier. GeoJSON viser kun veier med restriksjoner (OSM).</p>
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
  addStaticGeoJsonLayer();
  addExternalOgcLayer();
});

function addStaticGeoJsonLayer() {
  map.addSource("static-geojson", {
    type: "geojson",
    data: config.staticGeoJson
  });

  map.addLayer({
    id: "static-roads",
    type: "line",
    source: "static-geojson",
    paint: {
      "line-width": [
        "match",
        ["get", "highway"],
        "motorway",
        5,
        "trunk",
        4.5,
        "primary",
        4,
        "secondary",
        3,
        2
      ],
      "line-color": [
        "step",
        ["to-number", ["get", "maxheight"]],
        "#94a3b8",
        3.5,
        "#ef4444",
        4.0,
        "#f97316",
        4.5,
        "#22c55e"
      ],
      "line-opacity": 0.9
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

  map.on("click", "static-roads", (event) => {
    const feature = event.features?.[0];
    if (!feature) return;
    const { name, maxheight, maxweight, maxwidth, highway, ref } =
      feature.properties;
    new maplibregl.Popup()
      .setLngLat(event.lngLat)
      .setHTML(
        `<strong>${name || ref || "Uten navn"}</strong><br/>Type: ${highway}<br/>Maks høyde: ${maxheight || "?"} m<br/>Maks vekt: ${maxweight || "?"} t<br/>Maks bredde: ${maxwidth || "?"} m`
      )
      .addTo(map);
  });
}

function addExternalOgcLayer() {
  if (!config.externalOgcUrl) return;
  // Placeholder raster OGC (WMS/WMTS). Replace with your endpoint & params.
  map.addSource("external-ogc", {
    type: "raster",
    tiles: [
      `${config.externalOgcUrl}?service=WMS&request=GetMap&layers=kommunalveg,fylkesveg,riksveg,europaveg,privatveg,skogsbilveg,gang_og_sykkelveg,sykkelveg,bilferjestrekning&styles=&format=image/png&transparent=true&version=1.1.1&width=256&height=256&srs=EPSG:3857&bbox={bbox-epsg-3857}`
    ],
    tileSize: 256,
    attribution: "Kartverket Vegnett"
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
const loadSupabase = document.getElementById("load-supabase");

toggleStatic.addEventListener("change", (event) => {
  const visibility = event.target.checked ? "visible" : "none";
  if (map.getLayer("static-roads")) {
    map.setLayoutProperty("static-roads", "visibility", visibility);
  }
  if (map.getLayer("static-labels")) {
    map.setLayoutProperty("static-labels", "visibility", visibility);
  }
});

toggleOgc.addEventListener("change", (event) => {
  const visibility = event.target.checked ? "visible" : "none";
  if (map.getLayer("external-ogc-layer")) {
    map.setLayoutProperty("external-ogc-layer", "visibility", visibility);
  }
});

if (config.supabase.url && config.supabase.key) {
  loadSupabase.disabled = false;
}

loadSupabase.addEventListener("click", () => {
  alert("Supabase-henting ikke implementert ennå. Koble Supabase JS og legg til en kilde.");
});
