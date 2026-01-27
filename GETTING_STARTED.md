# 🚀 Kom i gang - Hurtigguide

Dette er en rask guide for å komme i gang med utviklingen.

## Første gang oppsett

### 1. Installer nødvendig programvare
- [Node.js](https://nodejs.org/) (v16+)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- En kodeeditor (VS Code anbefales)

### 2. Klon og sett opp prosjektet
```bash
git clone https://github.com/haakonhalvors1/Oppgave-1-Webutvikling-GIS-Kartografi.git
cd Oppgave-1-Webutvikling-GIS-Kartografi
npm install
```

### 3. Start utviklingsmiljøet

**Alternativ A: Kun webserver (enklest for utvikling)**
```bash
npm start
```
Åpne http://localhost:8080 i nettleseren

**Alternativ B: Med PostGIS database (for database-funksjonalitet)**
```bash
docker-compose up -d
```
- Webserver: http://localhost:8080
- Database: localhost:5432

## Mappestruktur

```
├── index.html          # Hovedside - endre her for UI-endringer
├── styles.css          # All CSS-styling
├── app.js              # All JavaScript-logikk
├── data/               # Dine GeoJSON-filer her
│   ├── cities.geojson
│   ├── national-parks.geojson
│   └── hiking-routes.geojson
├── init-db/            # Database-initialiseringsskript
│   └── 01-init.sql
├── package.json        # npm-avhengigheter
└── docker-compose.yml  # Docker-konfigurasjon
```

## Vanlige oppgaver

### Legge til nye GeoJSON-data
1. Legg filen i `data/` mappen
2. Last inn i `app.js`:
```javascript
async function loadMyData() {
    const response = await fetch('data/my-data.geojson');
    const data = await response.json();
    L.geoJSON(data).addTo(map);
}
```

### Endre kart-styling
- Rediger CSS-variabler i `styles.css`
- Endre Leaflet-stiler i `app.js` under `getCityStyle()`, `addNationalParksToMap()`, etc.

### Legge til nye databaser-tabeller
1. Rediger `init-db/01-init.sql`
2. Restart Docker:
```bash
docker-compose down -v
docker-compose up -d
```

### Koble til ekte OGC API
Erstatt simulert data i `loadOGCAPIData()`:
```javascript
async function loadOGCAPIData() {
    const response = await fetch('https://api.example.com/ogcapi/collections/items');
    const data = await response.json();
    L.geoJSON(data).addTo(layerGroups.ogcData);
}
```

## Debugging

### Åpne Developer Console
- Windows/Linux: `F12` eller `Ctrl+Shift+I`
- Mac: `Cmd+Option+I`

### Vanlige problemer

**Problem: Kartet vises ikke**
- Sjekk konsollen for feil
- Verifiser at Leaflet CSS og JS er lastet inn
- Sjekk at `#map` div har høyde i CSS

**Problem: GeoJSON vises ikke**
- Sjekk at filen er gyldig GeoJSON (bruk [geojson.io](https://geojson.io))
- Verifiser at koordinatene er i riktig rekkefølge: `[longitude, latitude]`
- Sjekk at data faktisk lastes inn (console.log)

**Problem: Database kobler ikke til**
- Sjekk at Docker kjører: `docker ps`
- Verifiser port ikke er i bruk: `lsof -i :5432` (Mac/Linux)
- Restart containers: `docker-compose restart`

## Nyttige kommandoer

```bash
# Start utviklingsserver
npm start

# Start Docker-miljø
docker-compose up -d

# Se Docker-logger
docker-compose logs -f

# Stopp Docker-miljø
docker-compose down

# Koble til PostgreSQL
docker exec -it gis-postgis psql -U gis_user -d gis_database

# Kjør SQL-spørring
docker exec -it gis-postgis psql -U gis_user -d gis_database -c "SELECT * FROM poi;"
```

## Lykke til! 🎉

Nå er dere klare til å utvikle deres eget interaktive webkart!
