// ============================================================================
// Interaktivt Webkart - GIS Kartografi
// Demonstrerer: GeoJSON, OGC API, PostGIS, koordinatsystemhåndtering
// ============================================================================

// Global variables
let map;
let layerGroups = {
    cities: null,
    nationalParks: null,
    hikingRoutes: null,
    poi: null,
    ogcData: null
};
let searchMarker = null;
let searchCircle = null;

// ============================================================================
// Map Initialization
// ============================================================================

function initMap() {
    // Initialize map centered on Norway
    map = L.map('map', {
        center: [61.0, 9.0],
        zoom: 5,
        zoomControl: true
    });

    // Add base layers
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    });

    const topoLayer = L.tileLayer('https://opencache.statkart.no/gatekeeper/gk/gk.open_gmaps?layers=topo4&zoom={z}&x={x}&y={y}', {
        attribution: '© Kartverket',
        maxZoom: 18
    });

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
        maxZoom: 19
    });

    // Set default base layer
    osmLayer.addTo(map);

    // Create base layer control
    const baseLayers = {
        "OpenStreetMap": osmLayer,
        "Topografisk (Kartverket)": topoLayer,
        "Satellitt": satelliteLayer
    };

    // Initialize layer groups for overlay data
    layerGroups.cities = L.layerGroup();
    layerGroups.nationalParks = L.layerGroup();
    layerGroups.hikingRoutes = L.layerGroup();
    layerGroups.poi = L.layerGroup();
    layerGroups.ogcData = L.layerGroup();

    // Create overlay layers control
    const overlayLayers = {
        "🏙️ Byer": layerGroups.cities,
        "🌲 Nasjonalparker": layerGroups.nationalParks,
        "🥾 Turruter": layerGroups.hikingRoutes,
        "📍 Severdigheter (PostGIS)": layerGroups.poi,
        "🌐 OGC API Data": layerGroups.ogcData
    };

    // Add layer control to map
    L.control.layers(baseLayers, overlayLayers, {
        position: 'topright',
        collapsed: false
    }).addTo(map);

    // Add scale control
    L.control.scale({
        position: 'bottomleft',
        imperial: false,
        metric: true
    }).addTo(map);

    // Setup mouse coordinate tracking
    setupCoordinateTracking();

    // Setup click event for spatial queries
    map.on('click', onMapClick);
}

// ============================================================================
// Coordinate System Handling
// ============================================================================

function setupCoordinateTracking() {
    // Track mouse movement for coordinate display
    map.on('mousemove', function(e) {
        const coords = e.latlng;
        const coordDisplay = document.getElementById('mouse-coords');
        
        // Display in multiple coordinate systems
        const wgs84 = `${coords.lat.toFixed(5)}°N, ${coords.lng.toFixed(5)}°E`;
        
        // Convert to UTM 33N (common in Norway) using proj4
        if (typeof proj4 !== 'undefined') {
            try {
                proj4.defs("EPSG:32633", "+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs");
                const utm = proj4('EPSG:4326', 'EPSG:32633', [coords.lng, coords.lat]);
                coordDisplay.innerHTML = `
                    <strong>WGS84:</strong> ${wgs84}<br>
                    <strong>UTM 33N:</strong> ${utm[0].toFixed(0)}E, ${utm[1].toFixed(0)}N
                `;
            } catch (e) {
                coordDisplay.textContent = wgs84;
            }
        } else {
            coordDisplay.textContent = wgs84;
        }
    });
}

function transformCoordinates(lng, lat, fromProj, toProj) {
    if (typeof proj4 !== 'undefined') {
        try {
            return proj4(fromProj, toProj, [lng, lat]);
        } catch (e) {
            console.error('Coordinate transformation error:', e);
            return [lng, lat];
        }
    }
    return [lng, lat];
}

// ============================================================================
// Data Loading Functions
// ============================================================================

async function loadGeoJSONData() {
    try {
        // Load cities
        const citiesResponse = await fetch('data/cities.geojson');
        const citiesData = await citiesResponse.json();
        addCitiesToMap(citiesData);

        // Load national parks
        const parksResponse = await fetch('data/national-parks.geojson');
        const parksData = await parksResponse.json();
        addNationalParksToMap(parksData);

        // Load hiking routes
        const routesResponse = await fetch('data/hiking-routes.geojson');
        const routesData = await routesResponse.json();
        addHikingRoutesToMap(routesData);

        console.log('GeoJSON data loaded successfully');
    } catch (error) {
        console.error('Error loading GeoJSON data:', error);
    }
}

// ============================================================================
// Data-Driven Styling Functions
// ============================================================================

function getCityStyle(population) {
    const usePopulationSize = document.getElementById('toggle-population')?.checked ?? true;
    const useColors = document.getElementById('toggle-colors')?.checked ?? true;
    
    // Size based on population
    let radius = 8;
    if (usePopulationSize) {
        radius = Math.sqrt(population / 10000) + 5;
    }
    
    // Color based on category
    let fillColor = '#3182ce';
    if (useColors) {
        if (population > 500000) {
            fillColor = '#c53030'; // Red for largest cities
        } else if (population > 200000) {
            fillColor = '#dd6b20'; // Orange for large cities
        } else if (population > 100000) {
            fillColor = '#d69e2e'; // Yellow for medium cities
        } else {
            fillColor = '#3182ce'; // Blue for smaller cities
        }
    }
    
    return {
        radius: radius,
        fillColor: fillColor,
        color: '#2c5282',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.7
    };
}

function addCitiesToMap(geojson) {
    L.geoJSON(geojson, {
        pointToLayer: function(feature, latlng) {
            const style = getCityStyle(feature.properties.population);
            return L.circleMarker(latlng, style);
        },
        onEachFeature: function(feature, layer) {
            const props = feature.properties;
            const popupContent = `
                <h3>${props.name}</h3>
                <p><strong>Type:</strong> ${props.type}</p>
                <p><strong>Befolkning:</strong> ${props.population.toLocaleString('no-NO')}</p>
                <p><strong>Beskrivelse:</strong> ${props.description}</p>
            `;
            layer.bindPopup(popupContent);
            
            // Highlight on hover
            layer.on('mouseover', function() {
                this.setStyle({ fillOpacity: 1, weight: 3 });
            });
            layer.on('mouseout', function() {
                this.setStyle({ fillOpacity: 0.7, weight: 2 });
            });
        }
    }).addTo(layerGroups.cities);
    
    layerGroups.cities.addTo(map);
}

function addNationalParksToMap(geojson) {
    L.geoJSON(geojson, {
        style: function(feature) {
            return {
                fillColor: '#48bb78',
                weight: 2,
                opacity: 1,
                color: '#2f855a',
                fillOpacity: 0.4
            };
        },
        onEachFeature: function(feature, layer) {
            const props = feature.properties;
            const popupContent = `
                <h3>${props.name}</h3>
                <p><strong>Areal:</strong> ${props.area_km2} km²</p>
                <p><strong>Etablert:</strong> ${props.established}</p>
                <p><strong>Beskrivelse:</strong> ${props.description}</p>
            `;
            layer.bindPopup(popupContent);
            
            layer.on('mouseover', function() {
                this.setStyle({ fillOpacity: 0.6 });
            });
            layer.on('mouseout', function() {
                this.setStyle({ fillOpacity: 0.4 });
            });
        }
    }).addTo(layerGroups.nationalParks);
    
    layerGroups.nationalParks.addTo(map);
}

function addHikingRoutesToMap(geojson) {
    L.geoJSON(geojson, {
        style: function(feature) {
            const difficulty = feature.properties.difficulty;
            let color = '#ed8936'; // Orange for medium
            
            if (difficulty === 'Lett') {
                color = '#48bb78'; // Green for easy
            } else if (difficulty === 'Krevende') {
                color = '#e53e3e'; // Red for difficult
            }
            
            return {
                color: color,
                weight: 4,
                opacity: 0.8
            };
        },
        onEachFeature: function(feature, layer) {
            const props = feature.properties;
            const popupContent = `
                <h3>${props.name}</h3>
                <p><strong>Vanskelighetsgrad:</strong> ${props.difficulty}</p>
                <p><strong>Lengde:</strong> ${props.length_km} km</p>
                <p><strong>Estimert tid:</strong> ${props.duration_hours} timer</p>
                <p><strong>Beskrivelse:</strong> ${props.description}</p>
            `;
            layer.bindPopup(popupContent);
            
            layer.on('mouseover', function() {
                this.setStyle({ weight: 6, opacity: 1 });
            });
            layer.on('mouseout', function() {
                this.setStyle({ weight: 4, opacity: 0.8 });
            });
        }
    }).addTo(layerGroups.hikingRoutes);
    
    layerGroups.hikingRoutes.addTo(map);
}

// ============================================================================
// PostGIS / Database Integration (Simulated)
// ============================================================================

function loadPostGISData() {
    // In a real application, this would make API calls to a backend
    // that queries PostGIS. For demonstration, we'll use simulated data.
    
    const simulatedPOI = {
        type: "FeatureCollection",
        features: [
            {
                type: "Feature",
                properties: {
                    name: "Oslo Rådhus",
                    category: "Landmark",
                    description: "Oslo byhus og rådhus"
                },
                geometry: {
                    type: "Point",
                    coordinates: [10.7342, 59.9117]
                }
            },
            {
                type: "Feature",
                properties: {
                    name: "Bergen Bryggen",
                    category: "Landmark",
                    description: "Historisk havnefront i Bergen"
                },
                geometry: {
                    type: "Point",
                    coordinates: [5.3244, 60.3975]
                }
            },
            {
                type: "Feature",
                properties: {
                    name: "Nidarosdomen",
                    category: "Landmark",
                    description: "Katedral i Trondheim"
                },
                geometry: {
                    type: "Point",
                    coordinates: [10.3951, 63.4269]
                }
            },
            {
                type: "Feature",
                properties: {
                    name: "Vigelandsparken",
                    category: "Park",
                    description: "Skulpturpark i Oslo"
                },
                geometry: {
                    type: "Point",
                    coordinates: [10.7003, 59.9274]
                }
            }
        ]
    };
    
    L.geoJSON(simulatedPOI, {
        pointToLayer: function(feature, latlng) {
            return L.circleMarker(latlng, {
                radius: 6,
                fillColor: '#e53e3e',
                color: '#c53030',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            });
        },
        onEachFeature: function(feature, layer) {
            const props = feature.properties;
            const popupContent = `
                <h3>${props.name}</h3>
                <p><strong>Kategori:</strong> ${props.category}</p>
                <p><strong>Beskrivelse:</strong> ${props.description}</p>
                <p><em>Kilde: PostGIS Database</em></p>
            `;
            layer.bindPopup(popupContent);
        }
    }).addTo(layerGroups.poi);
    
    layerGroups.poi.addTo(map);
}

// ============================================================================
// OGC API Features Integration (Simulated)
// ============================================================================

function loadOGCAPIData() {
    // In a real application, this would fetch from an OGC API Features service
    // For demonstration, we'll use simulated data
    
    const simulatedOGCData = {
        type: "FeatureCollection",
        features: [
            {
                type: "Feature",
                properties: {
                    name: "Meteorological Station Oslo",
                    type: "Weather Station",
                    temperature: "12°C",
                    source: "OGC API Features"
                },
                geometry: {
                    type: "Point",
                    coordinates: [10.72, 59.91]
                }
            },
            {
                type: "Feature",
                properties: {
                    name: "Meteorological Station Bergen",
                    type: "Weather Station",
                    temperature: "10°C",
                    source: "OGC API Features"
                },
                geometry: {
                    type: "Point",
                    coordinates: [5.33, 60.39]
                }
            }
        ]
    };
    
    L.geoJSON(simulatedOGCData, {
        pointToLayer: function(feature, latlng) {
            const icon = L.divIcon({
                className: 'custom-icon',
                html: '🌡️',
                iconSize: [25, 25]
            });
            return L.marker(latlng, { icon: icon });
        },
        onEachFeature: function(feature, layer) {
            const props = feature.properties;
            const popupContent = `
                <h3>${props.name}</h3>
                <p><strong>Type:</strong> ${props.type}</p>
                <p><strong>Temperatur:</strong> ${props.temperature}</p>
                <p><em>Kilde: ${props.source}</em></p>
            `;
            layer.bindPopup(popupContent);
        }
    }).addTo(layerGroups.ogcData);
}

// ============================================================================
// Spatial Query Functions
// ============================================================================

function onMapClick(e) {
    // Place or update search marker
    if (searchMarker) {
        map.removeLayer(searchMarker);
    }
    
    searchMarker = L.marker(e.latlng, {
        icon: L.divIcon({
            className: 'search-marker',
            html: '📍',
            iconSize: [30, 30]
        })
    }).addTo(map);
    
    searchMarker.bindPopup('Klikk "Søk nær markør" for å finne objekter innenfor radius').openPopup();
}

function performSpatialQuery() {
    if (!searchMarker) {
        alert('Klikk først på kartet for å plassere en søkemarkør');
        return;
    }
    
    const radius = parseFloat(document.getElementById('radius-input').value);
    const searchLatLng = searchMarker.getLatLng();
    
    // Remove old search circle if exists
    if (searchCircle) {
        map.removeLayer(searchCircle);
    }
    
    // Draw search radius circle (radius is in km, convert to meters)
    searchCircle = L.circle(searchLatLng, {
        radius: radius * 1000,
        color: '#667eea',
        fillColor: '#667eea',
        fillOpacity: 0.2,
        weight: 2
    }).addTo(map);
    
    // Perform query - find all features within radius
    const results = findFeaturesWithinRadius(searchLatLng, radius);
    
    // Display results
    displayQueryResults(results, radius);
}

function findFeaturesWithinRadius(center, radiusKm) {
    const results = {
        cities: [],
        parks: [],
        routes: [],
        poi: []
    };
    
    // Check cities layer
    if (layerGroups.cities) {
        layerGroups.cities.eachLayer(function(layer) {
            if (layer.feature) {
                const distance = calculateDistance(center, layer.getLatLng());
                if (distance <= radiusKm) {
                    results.cities.push({
                        name: layer.feature.properties.name,
                        distance: distance.toFixed(2)
                    });
                }
            }
        });
    }
    
    // Check POI layer
    if (layerGroups.poi) {
        layerGroups.poi.eachLayer(function(layer) {
            if (layer.feature) {
                const distance = calculateDistance(center, layer.getLatLng());
                if (distance <= radiusKm) {
                    results.poi.push({
                        name: layer.feature.properties.name,
                        category: layer.feature.properties.category,
                        distance: distance.toFixed(2)
                    });
                }
            }
        });
    }
    
    return results;
}

function calculateDistance(latlng1, latlng2) {
    // Calculate distance in km using Haversine formula
    const R = 6371; // Earth's radius in km
    const dLat = toRad(latlng2.lat - latlng1.lat);
    const dLon = toRad(latlng2.lng - latlng1.lng);
    const lat1 = toRad(latlng1.lat);
    const lat2 = toRad(latlng2.lat);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.sin(dLon/2) * Math.sin(dLon/2) * 
              Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function toRad(degrees) {
    return degrees * Math.PI / 180;
}

function displayQueryResults(results, radius) {
    const resultsDiv = document.getElementById('query-results');
    let html = `<h4>Søkeresultater (innenfor ${radius} km):</h4>`;
    
    let totalResults = 0;
    
    if (results.cities.length > 0) {
        html += '<h5>🏙️ Byer:</h5><ul>';
        results.cities.forEach(city => {
            html += `<li>${city.name} (${city.distance} km)</li>`;
            totalResults++;
        });
        html += '</ul>';
    }
    
    if (results.poi.length > 0) {
        html += '<h5>📍 Severdigheter:</h5><ul>';
        results.poi.forEach(poi => {
            html += `<li>${poi.name} - ${poi.category} (${poi.distance} km)</li>`;
            totalResults++;
        });
        html += '</ul>';
    }
    
    if (totalResults === 0) {
        html += '<p><em>Ingen objekter funnet innenfor søkeradiusen.</em></p>';
    }
    
    resultsDiv.innerHTML = html;
}

// ============================================================================
// Event Listeners
// ============================================================================

function setupEventListeners() {
    // Spatial query button
    document.getElementById('search-btn').addEventListener('click', performSpatialQuery);
    
    // Styling toggles
    document.getElementById('toggle-population').addEventListener('change', function() {
        // Reload cities with new styling
        layerGroups.cities.clearLayers();
        loadGeoJSONData();
    });
    
    document.getElementById('toggle-colors').addEventListener('change', function() {
        // Reload cities with new styling
        layerGroups.cities.clearLayers();
        loadGeoJSONData();
    });
}

// ============================================================================
// Initialize Application
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Interactive Web Map...');
    
    // Initialize map
    initMap();
    
    // Load all data
    loadGeoJSONData();
    loadPostGISData();
    loadOGCAPIData();
    
    // Setup event listeners
    setupEventListeners();
    
    console.log('Map initialized successfully!');
});
