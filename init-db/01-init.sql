-- Initialize PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create table for points of interest (POI)
CREATE TABLE IF NOT EXISTS poi (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    geom GEOMETRY(Point, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create table for administrative boundaries
CREATE TABLE IF NOT EXISTS boundaries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100),
    population INTEGER,
    area_km2 DECIMAL(10, 2),
    geom GEOMETRY(Polygon, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create spatial indexes
CREATE INDEX IF NOT EXISTS poi_geom_idx ON poi USING GIST(geom);
CREATE INDEX IF NOT EXISTS boundaries_geom_idx ON boundaries USING GIST(geom);

-- Insert sample POI data (Norwegian cities and landmarks)
INSERT INTO poi (name, category, description, geom) VALUES
    ('Oslo Rådhus', 'Landmark', 'Oslo byhus og rådhus', ST_SetSRID(ST_MakePoint(10.7342, 59.9117), 4326)),
    ('Bergen Bryggen', 'Landmark', 'Historisk havnefront i Bergen', ST_SetSRID(ST_MakePoint(5.3244, 60.3975), 4326)),
    ('Nidarosdomen', 'Landmark', 'Katedral i Trondheim', ST_SetSRID(ST_MakePoint(10.3951, 63.4269), 4326)),
    ('Preikestolen', 'Nature', 'Fjellformasjon i Rogaland', ST_SetSRID(ST_MakePoint(6.1900, 58.9867), 4326)),
    ('Vigelandsparken', 'Park', 'Skulpturpark i Oslo', ST_SetSRID(ST_MakePoint(10.7003, 59.9274), 4326)),
    ('Holmenkollen', 'Sport', 'Skihoppbakke i Oslo', ST_SetSRID(ST_MakePoint(10.6666, 59.9634), 4326)),
    ('Akershus festning', 'Historic', 'Middelalderborg i Oslo', ST_SetSRID(ST_MakePoint(10.7362, 59.9075), 4326)),
    ('Tromsø Museum', 'Museum', 'Universitetsmuseum i Tromsø', ST_SetSRID(ST_MakePoint(18.9560, 69.6492), 4326));

-- Insert sample boundary data (Norwegian regions - simplified)
INSERT INTO boundaries (name, type, population, area_km2, geom) VALUES
    ('Oslo', 'Kommune', 697549, 454.07, 
     ST_SetSRID(ST_GeomFromText('POLYGON((10.6 59.85, 10.9 59.85, 10.9 60.0, 10.6 60.0, 10.6 59.85))'), 4326)),
    ('Bergen', 'Kommune', 283929, 465.00,
     ST_SetSRID(ST_GeomFromText('POLYGON((5.2 60.3, 5.5 60.3, 5.5 60.5, 5.2 60.5, 5.2 60.3))'), 4326)),
    ('Trondheim', 'Kommune', 207595, 342.00,
     ST_SetSRID(ST_GeomFromText('POLYGON((10.3 63.35, 10.5 63.35, 10.5 63.5, 10.3 63.5, 10.3 63.35))'), 4326)),
    ('Tromsø', 'Kommune', 77095, 2558.00,
     ST_SetSRID(ST_GeomFromText('POLYGON((18.8 69.55, 19.1 69.55, 19.1 69.75, 18.8 69.75, 18.8 69.55))'), 4326));

-- Create function for spatial query (find POIs within boundary)
CREATE OR REPLACE FUNCTION get_poi_in_boundary(boundary_id INTEGER)
RETURNS TABLE(
    poi_name VARCHAR,
    poi_category VARCHAR,
    poi_description TEXT,
    distance_km DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.name,
        p.category,
        p.description,
        ROUND(ST_Distance(p.geom::geography, b.geom::geography) / 1000, 2) as distance_km
    FROM poi p
    CROSS JOIN boundaries b
    WHERE b.id = boundary_id
    AND ST_Within(p.geom, b.geom)
    ORDER BY p.name;
END;
$$ LANGUAGE plpgsql;

-- Create function for buffer query
CREATE OR REPLACE FUNCTION get_poi_near_point(lon DECIMAL, lat DECIMAL, radius_km DECIMAL)
RETURNS TABLE(
    poi_name VARCHAR,
    poi_category VARCHAR,
    distance_km DECIMAL,
    poi_lon DECIMAL,
    poi_lat DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.name,
        p.category,
        ROUND(ST_Distance(
            ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
            p.geom::geography
        ) / 1000, 2) as distance_km,
        ST_X(p.geom) as poi_lon,
        ST_Y(p.geom) as poi_lat
    FROM poi p
    WHERE ST_DWithin(
        ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
        p.geom::geography,
        radius_km * 1000
    )
    ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql;
