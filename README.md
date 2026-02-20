# Kriseveier for spesialkjøretøy

> Interaktivt webkart for planlegging av transport med spesialkjøretøy basert på vegnett og restriksjonsdata fra NVDB (Nasjonal vegdatabank).

## Prosjektnavn & TLDR
**Prosjektnavn:** Kriseveier for spesialkjøretøy

Dette kartet løser problemet med å identifisere kjørbare veier for store kjøretøy ved å visualisere vegbredde, høydebegrensninger og bruksklasser dynamisk fra NVDB. Brukeren kan angi kjøretøyets bredde og filtrere bort veier som er for smale, samt se detaljert informasjon om veglenker inkludert kjøreretning og antall kjørefelt. Kartet henter data i sanntid basert på kartutsnitt, slik at man alltid får oppdatert informasjon om vegnettet i det valgte området.

## Demo av system
*Merk: Video/GIF av systemet vil legges til her*

### Funksjonalitet
- Dynamisk lasting av vegnett fra NVDB basert på kartutsnitt
- Visualisering av høydebegrensninger, vegbredde og bruksklasse (vekt)
- Filtrering basert på kjøretøybredde med fargekoding (grønn = kjørbar, rød = for smal)
- Detaljert popup-informasjon med veglenkeretning, kjørefelt og restriksjoner
- Liste over kjørbare veier sortert etter vegbredde
- WMS-lag fra Kartverket Elveg for komplett vegnettdekning

## Teknisk Stack

| Teknologi | Versjon | Beskrivelse |
|-----------|---------|-------------|
| **MapLibre GL JS** | 4.3.2 | Åpen kildekode kartbibliotek for interaktive vektorkart |
| **Vite** | 6.0.0 | Moderne build-verktøy for rask utvikling |
| **osmtogeojson** | 3.0.0-beta.5 | Konvertering av OSM-data til GeoJSON |
| **Node.js** | 20+ | JavaScript runtime environment |

### API-integrasjoner
- **NVDB API v3** (Statens vegvesen): Vegnett, høydebegrensninger, vegbredde, bruksklasse
- **Kartverket Elveg WMS**: Vegnett som bakgrunnslag
- **Carto Positron**: Nøytralt bakgrunnskart

## Datakatalog

| Datasett | Kilde | Format | Bearbeiding |
|----------|-------|--------|-------------|
| **Vegnett (statisk)** | Kartverket Elveg WMS | WMS (raster) | WMS-request med EPSG:3857, tilesize 256x256 |
| **Veglenkesekvenser** | NVDB API v3 (objekt: vegnett) | JSON → GeoJSON | Parsing av WKT geometri, konvertering fra SRID 4326 (lat/lon → lon/lat), max 300 features per request |
| **Høydebegrensning** | NVDB API v3 (objekt 591) | JSON → GeoJSON | Parsing av WKT, normalisering av høydeverdi (komma → punktum) |
| **Vegbredde** | NVDB API v3 (objekt 838) | JSON → GeoJSON | Parsing av WKT, normalisering av breddeverdi, spatial matching til vegnett (max 35m avstand) |
| **Bruksklasse (vekt)** | NVDB API v3 (objekt 904) | JSON → GeoJSON | Parsing av WKT, klassifikasjon av bruksklasse |
| **Sample GeoJSON** | Lokal fil | GeoJSON | Eksempeldata med properties: maxheight, maxweight, maxwidth |

### NVDB API-parametre
- **SRID**: 4326 (WGS84)
- **Kartutsnitt**: Dynamisk bbox fra MapLibre bounds (west, south, east, north)
- **Antall**: Maks 300 features per request
- **Min zoom**: 10 (for å unngå for store datamengder)

## Arkitekturskisse

```
┌─────────────────────────────────────────────────────────────────┐
│                          DATAKILDER                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐        │
│  │ Kartverket   │   │  NVDB API v3 │   │ Carto CDN    │        │
│  │ Elveg WMS    │   │ (Vegvesen)   │   │ Basemap      │        │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘        │
│         │                  │                   │                 │
└─────────┼──────────────────┼───────────────────┼─────────────────┘
          │                  │                   │
          │                  │                   │
┌─────────▼──────────────────▼───────────────────▼─────────────────┐
│                    VITE DEV SERVER                                │
│                  (Proxy: /nvdb → NVDB API)                        │
└─────────┬─────────────────────────────────────────────────────────┘
          │
          │
┌─────────▼─────────────────────────────────────────────────────────┐
│                     DATABEARBEIDING (main.js)                      │
├────────────────────────────────────────────────────────────────────┤
│  1. WMS-tiles hentes direkte til MapLibre                         │
│  2. NVDB JSON → parseLineString() → koordinattransformering       │
│     (LAT LON → LON LAT for SRID 4326)                             │
│  3. Geometriberegning:                                             │
│     - haversineMeters(): avstander mellom punkter                  │
│     - lineMidpointCoord(): midtpunkt på veglenker                  │
│     - computeBearingDegrees(): retning (0-360°)                    │
│     - bearingToArrow() / bearingToCompass(): visuelle indikatorer  │
│  4. Spatial matching:                                              │
│     - attachWidthToRoadnet(): koble vegbredde til veglenker        │
│       (max 35m avstand mellom midtpunkter)                         │
│  5. Kjørefeltsanalyse:                                             │
│     - Parse feltoversikt (partall mot, oddetall med retning)       │
│  6. GeoJSON FeatureCollection genereres for hvert lag              │
└─────────┬──────────────────────────────────────────────────────────┘
          │
          │
┌─────────▼──────────────────────────────────────────────────────────┐
│                    MAPLIBRE GL JS KARTLAG                          │
├────────────────────────────────────────────────────────────────────┤
│  - elveg-wms-layer (raster)                                        │
│  - nvdb-roadnet-line (line) - alle veglenker                       │
│  - nvdb-roadnet-passable (line) - grønne kjørbare veier            │
│  - nvdb-roadnet-too-narrow (line) - røde for smale veier           │
│  - nvdb-roadnet-direction (symbol) - retningspiler                 │
│  - nvdb-height-line (line) - høydebegrensninger (rød)              │
│  - nvdb-width-line (line) - vegbredde (lilla)                      │
│  - nvdb-weight-line (line) - bruksklasse (oransje)                 │
└─────────┬──────────────────────────────────────────────────────────┘
          │
          │
┌─────────▼──────────────────────────────────────────────────────────┐
│                    UI-KONTROLLER (style.css)                       │
├────────────────────────────────────────────────────────────────────┤
│  - Checkboxes: toggle layer visibility                             │
│  - Input: kjøretøybredde (trigger filter update)                   │
│  - Filter: vis bare kjørbare veier                                 │
│  - Liste: kjørbare veier sortert etter bredde                      │
│  - Popup: klikk på feature → detaljert info                        │
└─────────┬──────────────────────────────────────────────────────────┘
          │
          │
┌─────────▼──────────────────────────────────────────────────────────┐
│                         BRUKERINTERAKSJON                          │
├────────────────────────────────────────────────────────────────────┤
│  - Pan/zoom kart → moveend event → scheduleNvdbFetch()             │
│    (350ms debounce) → refreshNvdbData()                            │
│  - Klikk på veglenke → popup med detaljer                          │
│  - Klikk i liste → flyTo() midtpunkt på valgt veg                  │
│  - Endre kjøretøybredde → oppdater filters + liste                 │
└────────────────────────────────────────────────────────────────────┘
```

### Dataflyt i detalj
1. **Initialisering**: Kartet lastes med Carto Positron bakgrunn, Elveg WMS og tomme GeoJSON-kilder
2. **Brukerinteraksjon**: Ved pan/zoom utløses `moveend`-event
3. **Debouncing**: 350ms timer før API-kall for å unngå spam
4. **API-requests**: Fire parallelle requests til NVDB (vegnett, høyde, bredde, vekt) med bbox-parameter
5. **Parsing**: WKT geometri → GeoJSON coordinates med koordinatkonvertering
6. **Beregning**: Bearing, midtpunkt, kjørefeltsanalyse
7. **Spatial join**: Vegbredde matches til veglenker via næreste-nabo (35m radius)
8. **Rendering**: GeoJSON oppdateres i MapLibre sources → lag re-rendres
9. **Filtrering**: MapLibre filters anvendes basert på kjøretøybredde
10. **UI-oppdatering**: Liste over kjørbare veier genereres og sorteres

## Kom i gang

### Forutsetninger (Mac med Homebrew)
```bash
# Sjekk om Node.js er installert
node --version

# Hvis ikke installert, installer Node.js 20+ via Homebrew
brew install node@20

# Verifiser installasjon
node --version  # skal vise v20.x.x eller nyere
npm --version   # skal vise npm versjon
```

### Installasjon og kjøring
```bash
# Klon repository (hvis ikke allerede gjort)
git clone https://github.com/[username]/Oppgave-1-Webutvikling-GIS-Kartografi.git
cd Oppgave-1-Webutvikling-GIS-Kartografi

# Naviger til web-mappen
cd web

# Installer avhengigheter
npm install

# Start utviklingsserver
npm run dev

# Åpne i browser
# Kartet kjører på http://localhost:4173
```

### Build for produksjon
```bash
# Bygg optimalisert versjon
npm run build

# Preview produksjonsbygget
npm run preview
```

## Mappestruktur
```
Oppgave-1-Webutvikling-GIS-Kartografi/
├── LICENSE
├── README.md
└── web/
    ├── index.html              # HTML entry point
    ├── package.json            # NPM dependencies og scripts
    ├── vite.config.js          # Vite config med NVDB proxy
    ├── public/
    │   └── data/
    │       ├── norway_restrictions.geojson    # (ikke brukt i løsningen)
    │       ├── norway_restrictions.osm.json   # (ikke brukt i løsningen)
    │       └── sample.geojson                 # Eksempeldata
    └── src/
        ├── main.js             # Hovedapplikasjon (895 linjer)
        └── style.css           # UI-styling
```

## Refleksjon

### Hva fungerer godt?
- **Dynamisk datalasting**: Kartutsnitt-basert henting fra NVDB sikrer at man alltid får relevant data uten å laste ned hele Norge. Debouncing (350ms) gir god responsivitet uten å spamme API-et.
- **Spatial matching**: Algoritmen for å koble vegbredde til veglenker fungerer overraskende bra med 35-meters radius. Dette kompenserer for at punkter ikke ligger eksakt på samme koordinat.
- **Retningsanalyse**: Bearing-beregning og kjørefeltsanalyse (partall mot, oddetall med retning) gir verdifull kontekst for vegplanlegging.

### Forbedringspunkter
1. **Ytelse ved store datasett**: Ved zoom-nivå 10-12 i tettbygde områder kan 300 features være for mye. Skulle implementert clustering eller tile-basert vektordata (PMTiles/MVT).
2. **Koordinatsystem-håndtering**: NVDB returnerer WKT med lat/lon i "feil" rekkefølge for SRID 4326. Dette er håndtert manuelt, men burde vært validert mot flere områder (spesielt nær datogrensen).
3. **Feilhåndtering**: Mangler retry-logikk og user-friendly feilmeldinger hvis NVDB API er nede eller returnerer ugyldige data.
4. **Caching**: Samme data hentes på nytt hvis man zoomer inn og ut igjen. LocalStorage eller IndexedDB-cache ville redusert unødvendige API-kall.
5. **Vegbredde-matching**: 35-meters radius er empirisk valgt. Ville vært bedre med en adaptiv algoritme basert på veitype (motorvei vs lokalvei) eller eksplisitt veglenke-ID fra NVDB hvis tilgjengelig.

### Teknisk lærdom
- **WKT-parsing**: NVDB bruker WKT for geometri, noe som krever custom parsing i frontend. En backend med PostGIS kunne konvertert dette til standardisert GeoJSON.
- **CORS og proxying**: Vite proxy er perfekt for utvikling, men produksjon krever enten CORS-headers fra NVDB eller egen backend-proxy.
- **MapLibre filters**: Expression-baserte filters er kraftige, men debugging kan være vanskelig. Konsoll-logging av feature properties var essensielt under utvikling. 
