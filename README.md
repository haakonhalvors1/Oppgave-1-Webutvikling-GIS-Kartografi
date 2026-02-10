# Oppgave-1-Webutvikling-GIS-Kartografi

> Mal for å bygge webkart som kombinerer statiske filer, OGC API og (valgfritt) Supabase/PostGIS. Fyll inn detaljene under etter hvert som dere implementerer.

## Prosjektnavn & TLDR
- **Prosjektnavn:** _Fyll inn_
- **TLDR (3 setninger):** _Hva løser kartet?_

## Begrunnelse for kartvalg
Vi bruker MapLibre GL JS fordi det er et åpent og lett kartbibliotek som støtter både vektor‑stil og eksterne OGC‑tjenester uten låsing til en leverandør. Kartverket Vegnett (WMS) brukes som ekstern OGC‑kilde for å sikre komplett vegdekning i hele Norge, mens et eget GeoJSON‑lag viser kun veier med restriksjoner (f.eks. maks høyde/vekt/bredde) for å muliggjøre filtrering for spesialkjøretøy. Bakgrunnskartet (Carto Positron) er nøytralt og gir god lesbarhet uten å konkurrere visuelt med veg‑ og restriksjonsdataene.

## Demo
- Legg inn video/gif-lenke eller skjermbilde når klart.

## Teknisk stack
- Kartbibliotek: MapLibre GL JS (via CDN, se web/src/main.js)
- Byggeverktøy: Vite
- Opsjonell database: PostGIS/Supabase (kan kobles til senere)
- Opsjonell OGC-kilde: GeoNorge/Kartverket eller annen WMS/WMTS/OGC API

## Kom i gang

### 1) Forutsetninger
- Node 20+

### 2) Installer og start lokalt (uten Docker)
```bash
cd web
npm install
npm run dev
# åpne http://localhost:4173
```

### 3) (Valgfritt senere) Docker Compose
- Docker er tatt ut for nå. Legg til compose/Dockerfile igjen hvis dere vil kjøre web + PostGIS i containere.

## Mappestruktur (kort)
- web/index.html – Vite entry
- web/src/main.js – kartoppsett, layer-kontroller, filter-mal
- web/src/style.css – enkel UI-styling
- web/public/data/sample.geojson – eksempeldata (erstatt med eget)
- (docker-compose.yml) – legges til senere ved behov

## Datakatalog (fyll ut)
| Datasett | Kilde | Format | Bearbeiding |
| --- | --- | --- | --- |
| Statisk GeoJSON | _Navn_ | GeoJSON | _F.eks. klippet i QGIS, reproj. til EPSG:4326_ |
| OGC API | _Tjeneste/lag_ | WMS/WMTS/OGC API | _Parametere/stiler_ |
| Supabase/PostGIS (valgfritt) | _Tabell/visning_ | SQL → GeoJSON | _F.eks. ST_AsGeoJSON med filter_ |

## Arkitekturskisse
- Beskriv flyten: Kilder → (ev. transformasjon) → kartlag → UI-kontroller → bruker.
- Legg inn diagram (bilde lenke eller ASCII) når klart.

## Hva gjenstår å implementere?
- Bytt ut sample.geojson med eget datasett og oppdater stil/attributter.
- Sett gyldig OGC-endepunkt i VITE_EXTERNAL_OGC_URL og juster lagparametere i web/src/main.js.
- (Valgfritt) Koble til Supabase/PostGIS og legg til kilde/lager i kartet.
- Legg til romlig spørring (buffer/bbox) eller SQL-baserte filter.
- Dokumenter demo (video/gif) og refleksjon (4–5 setninger) før levering.

## Refleksjon (fyll ut mot slutten)
- _Hva fungerer godt?_
- _Hva ville dere forbedret videre?_
- _Ytelse/dataflyt/koordinatsystem-lærdom?_ 
