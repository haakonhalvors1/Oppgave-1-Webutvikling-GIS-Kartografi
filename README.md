# 🗺️ Interaktivt Webkart - GIS Kartografi

**Gruppe 10 sin besvarelse for oppgave 1 i IS-218 Våren 2026**

Et omfattende interaktivt webkart som demonstrerer moderne GIS-teknologi og geografisk databehandling. Prosjektet kombinerer GeoJSON-filer, eksterne OGC API-tjenester og romlig database (PostGIS) med avanserte kartfunksjoner.

## 📋 Innholdsfortegnelse

- [Funksjoner](#-funksjoner)
- [Teknologier](#-teknologier)
- [Komme i gang](#-komme-i-gang)
- [Bruk](#-bruk)
- [Datakilder](#-datakilder)
- [Koordinatsystemhåndtering](#-koordinatsystemhåndtering)
- [API og Databaseintegrasjon](#-api-og-databaseintegrasjon)
- [Prosjektstruktur](#-prosjektstruktur)
- [Utviklere](#-utviklere)

## ✨ Funksjoner

### Interaktive Kartfunksjoner
- **Layer Control**: Bytt mellom ulike bakgrunnskart og datalag
- **Popups**: Klikk på objekter for detaljert informasjon
- **Hover-effekter**: Fremhev objekter ved museover
- **Responsive design**: Fungerer på desktop og mobile enheter

### Data-drevet Styling
- **Befolkningsbasert størrelse**: Byer vises med størrelse basert på innbyggertall
- **Kategoribaserte farger**: Automatisk fargesetting basert på egenskaper
- **Vanskelighetsgradsbaserte stiler**: Turruter med farger basert på vanskelighetsgrad
- **Dynamisk styling**: Endre visuell representasjon i sanntid

### Romlige Spørringer
- **Buffer-analyse**: Finn objekter innenfor en gitt radius
- **Avstandsberegninger**: Haversine-formel for nøyaktige avstander
- **Intersect-analyser**: Finn objekter som overlapper eller ligger innenfor områder
- **Resultatpresentasjon**: Visuelle og tekstlige resultater

### Koordinatsystemhåndtering
- **WGS84 (EPSG:4326)**: Standard koordinatsystem
- **UTM 33N (EPSG:32633)**: Norsk projeksjon
- **Proj4.js**: Koordinattransformasjon
- **Sanntidsvisning**: Se koordinater i flere systemer ved musebevegelse

## 🛠️ Teknologier

### Frontend
- **Leaflet 1.9.4**: Hovedbibliotek for interaktive kart
- **Proj4.js 2.9.2**: Koordinatsystemtransformasjon
- **Proj4Leaflet 1.0.2**: Leaflet-integrasjon for Proj4
- **HTML5 & CSS3**: Modern webstruktur og design
- **Vanilla JavaScript**: Ingen eksterne rammeverk

### Backend & Database
- **PostGIS 15-3.3**: Romlig database for geografiske data
- **PostgreSQL 15**: Relasjonsdatabase med geografisk utvidelse
- **Docker & Docker Compose**: Containerisering og orkestrerering
- **Nginx**: Webserver for produksjonsdistribusjon

### Dataformater
- **GeoJSON**: Standard format for vektordata
- **OGC API Features**: Moderne standard for geografiske web-tjenester
- **SQL/PostGIS**: Romlige spørringer og analyser

## 🚀 Komme i gang

### Forutsetninger
- [Node.js](https://nodejs.org/) (v16 eller nyere)
- [Docker](https://www.docker.com/) og Docker Compose
- Modern nettleser (Chrome, Firefox, Edge, Safari)

### Installasjon

1. **Klon repositoriet**
```bash
git clone https://github.com/haakonhalvors1/Oppgave-1-Webutvikling-GIS-Kartografi.git
cd Oppgave-1-Webutvikling-GIS-Kartografi
```

2. **Installer npm-avhengigheter**
```bash
npm install
```

3. **Start med Docker (anbefalt)**
```bash
docker-compose up -d
```

Dette starter:
- PostGIS database på port 5432
- Nginx webserver på port 8080

4. **Alternativt: Start lokal utviklingsserver**
```bash
npm start
```

Åpne nettleseren på http://localhost:8080

### Konfigurering av database

1. **Kopier miljøvariabler**
```bash
cp .env.example .env
```

2. **Rediger .env for dine innstillinger**
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gis_database
DB_USER=gis_user
DB_PASSWORD=gis_password
```

3. **Database initialiseres automatisk**
   - PostGIS-utvidelse installeres
   - Tabeller opprettes (poi, boundaries)
   - Eksempeldata lastes inn
   - Romlige indekser opprettes

## 📖 Bruk

### Grunnleggende Navigasjon
1. **Zoom**: Bruk mushjul eller +/- knapper
2. **Pan**: Klikk og dra kartet
3. **Layer Control**: Øverst til høyre - bytt mellom lag
4. **Popups**: Klikk på objekter for informasjon

### Romlig Spørring
1. Klikk på kartet for å plassere en søkemarkør
2. Angi radius i km (10-500 km)
3. Klikk "Søk nær markør"
4. Se resultater i kontrollpanelet

### Data-drevet Styling
- ✓ **Størrelse basert på befolkning**: Toggle for å aktivere/deaktivere
- ✓ **Farge basert på kategori**: Toggle for å aktivere/deaktivere
- Endringer oppdateres automatisk

### Lag-typer
- **🏙️ Byer**: Norske byer med befolkningsdata
- **🌲 Nasjonalparker**: Vernede områder med arealer
- **🥾 Turruter**: Populære fjellturer med vanskelighetsgrad
- **📍 Severdigheter**: POI-data fra PostGIS-database
- **🌐 OGC API Data**: Ekstern data fra OGC API Features

## 📊 Datakilder

### Lokale GeoJSON-filer
- `data/cities.geojson`: 7 norske byer med metadata
- `data/national-parks.geojson`: 3 nasjonalparker
- `data/hiking-routes.geojson`: 3 kjente turruter

### PostGIS Database
- **poi-tabell**: Severdigheter (landmarks, parker, museer)
- **boundaries-tabell**: Administrative grenser
- **Romlige funksjoner**: 
  - `get_poi_in_boundary(boundary_id)`: Finn POI i område
  - `get_poi_near_point(lon, lat, radius_km)`: Finn POI nær punkt

### OGC API Features
- Simulert værstasjonsdata
- I produksjon kan dette kobles til ekte OGC API-tjenester som:
  - [Kartverket API](https://www.kartverket.no/)
  - [Geonorge](https://www.geonorge.no/)

## 🌍 Koordinatsystemhåndtering

### Støttede Koordinatsystemer
- **EPSG:4326 (WGS84)**: Globalt geografisk koordinatsystem
- **EPSG:32633 (UTM 33N)**: Norsk projeksjon for nøyaktig måling

### Transformasjoner
```javascript
// Eksempel på koordinattransformasjon
proj4.defs("EPSG:32633", "+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs");
const utm = proj4('EPSG:4326', 'EPSG:32633', [lon, lat]);
```

### Avstandsberegninger
- **Haversine-formel**: Nøyaktig beregning av avstander på kuleflate
- **Geography-type i PostGIS**: Automatisk ellipsoidberegninger
- **Buffer-analyser**: Meter-nøyaktige søkeradiuser

## 🔌 API og Databaseintegrasjon

### PostGIS Spatial Queries

**Finn POI innenfor radius:**
```sql
SELECT * FROM get_poi_near_point(10.7522, 59.9139, 50);
```

**Finn POI i et område:**
```sql
SELECT * FROM get_poi_in_boundary(1);
```

### OGC API Features (Fremtidig integrasjon)

Eksempel på ekte OGC API-integrasjon:
```javascript
const ogcUrl = 'https://api.example.com/ogcapi/collections/cities/items';
const response = await fetch(ogcUrl);
const data = await response.json();
```

### Supabase Integrasjon (Alternativ til lokal PostGIS)

Bruk Supabase for cloud-basert PostGIS:
```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const { data, error } = await supabase
    .from('poi')
    .select('*')
    .filter('geom', 'st_dwithin', `POINT(${lon} ${lat})`, radius);
```

## 📁 Prosjektstruktur

```
Oppgave-1-Webutvikling-GIS-Kartografi/
├── index.html              # Hovedside med kartstruktur
├── styles.css              # CSS-styling for UI og kart
├── app.js                  # JavaScript-applikasjon
├── package.json            # npm-avhengigheter
├── docker-compose.yml      # Docker-konfigurasjon
├── .env.example            # Eksempel på miljøvariabler
├── .gitignore              # Git ignore-fil
├── README.md               # Denne filen
├── data/                   # GeoJSON-datafiler
│   ├── cities.geojson
│   ├── national-parks.geojson
│   └── hiking-routes.geojson
└── init-db/                # Database-initialiseringsskript
    └── 01-init.sql
```

## 🎓 Læringsutbytte

Dette prosjektet demonstrerer:

1. **Webkartteknologi**: Leaflet, tile-servere, interaktivitet
2. **Geografiske dataformater**: GeoJSON, WKT, spatial types
3. **Koordinatsystemhåndtering**: Projeksjoner, transformasjoner
4. **Romlige analyser**: Buffer, intersect, distance calculations
5. **Database-integrasjon**: PostGIS, spatial queries, indexing
6. **Web-standarder**: OGC API Features, WFS, WMS
7. **Containerisering**: Docker, docker-compose, miljøer
8. **Data-visualisering**: Symbolisering, choropleth, clustering
9. **Frontend-utvikling**: HTML5, CSS3, vanilla JavaScript
10. **Best practices**: Responsive design, error handling, documentation

## 👥 Utviklere

**Gruppe 10 - IS-218 Våren 2026**

## 📝 Lisens

MIT License - se [LICENSE](LICENSE) for detaljer.

## 🙏 Anerkjennelser

- **OpenStreetMap**: Bakgrunnskart
- **Kartverket**: Norske topografiske kart
- **Leaflet**: Kartebibliotek
- **PostGIS**: Romlig database
- **Esri**: Satellittbilder

## 📧 Kontakt

For spørsmål eller tilbakemeldinger, opprett en issue i GitHub-repositoriet.

---

**Happy Mapping! 🗺️**
