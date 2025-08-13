-- Drop existing tables and recreate with new schema
DROP TABLE IF EXISTS public.prices CASCADE;
DROP TABLE IF EXISTS public.stations CASCADE;

-- 1) Stations master (one row per physical outlet/charger)
CREATE TABLE IF NOT EXISTS public.stations (
  station_id        TEXT PRIMARY KEY,           -- e.g., "OCM:123456" or "CITY:TVM:BPCL:ABCD"
  source            TEXT NOT NULL,              -- "OCM", "PLACES", "MANUAL"
  station_type      TEXT NOT NULL,              -- 'petrol','diesel','cng','ev'
  provider          TEXT,                       -- e.g., IOCL/BPCL/HPCL/ATGL/Tata Power EZ/… 
  name              TEXT,
  address           TEXT,
  city              TEXT,
  state             TEXT,
  lat               NUMERIC,
  lng               NUMERIC,
  meta              JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- 2) Daily prices (append-only)
CREATE TABLE IF NOT EXISTS public.daily_prices (
  id                BIGSERIAL PRIMARY KEY,
  station_id        TEXT REFERENCES public.stations(station_id),
  as_of_date        DATE NOT NULL,              -- yyyy-mm-dd (local)
  fuel_type         TEXT NOT NULL,              -- 'petrol','diesel','cng','ev_kwh'
  price             NUMERIC,                    -- unit price (NULL if unknown)
  unit              TEXT,                       -- 'INR/L','INR/KG','INR/KWH'
  currency          TEXT DEFAULT 'INR',
  confidence        SMALLINT DEFAULT 80,        -- 0..100 (how reliable the source parsing is)
  source            TEXT,                       -- e.g., 'rapidapi:mi8y','ocm','data.gov.in'
  raw_payload       JSONB,                      -- full API response slice
  created_at        TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT dp_unique UNIQUE (station_id, as_of_date, fuel_type)
);

-- 3) Helper: city map (optional; for speed)
CREATE INDEX IF NOT EXISTS idx_stations_city ON public.stations(city);

-- Enable RLS
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_prices ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public read access
CREATE POLICY "Public read stations" 
ON public.stations 
FOR SELECT 
USING (true);

CREATE POLICY "Public read daily_prices" 
ON public.daily_prices 
FOR SELECT 
USING (true);

-- Update existing database functions to work with new schema
DROP FUNCTION IF EXISTS public.get_stations_for_map();
DROP FUNCTION IF EXISTS public.find_nearby_stations(double precision, double precision, double precision);

CREATE OR REPLACE FUNCTION public.get_stations_for_map()
 RETURNS TABLE(id text, name text, address text, latitude numeric, longitude numeric, type text, latest_price numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT 
    s.station_id as id,
    s.name,
    s.address,
    s.lat as latitude,
    s.lng as longitude,
    s.station_type as type,
    lp.price AS latest_price
  FROM public.stations s
  LEFT JOIN LATERAL (
    SELECT dp.price
    FROM public.daily_prices dp
    WHERE dp.station_id = s.station_id
    ORDER BY dp.as_of_date DESC, dp.created_at DESC
    LIMIT 1
  ) lp ON true;
$function$;

CREATE OR REPLACE FUNCTION public.find_nearby_stations(lat double precision, lng double precision, radius_km double precision DEFAULT 50)
 RETURNS TABLE(id text, name text, address text, latitude numeric, longitude numeric, type text, distance double precision, latest_price numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH base AS (
    SELECT 
      s.station_id as id,
      s.name,
      s.address,
      s.lat as latitude,
      s.lng as longitude,
      s.station_type as type,
      (
        6371 * 2 * ASIN(
          SQRT(
            POWER(SIN(RADIANS((lat - s.lat)) / 2), 2) +
            COS(RADIANS(lat)) * COS(RADIANS(s.lat)) *
            POWER(SIN(RADIANS((lng - s.lng)) / 2), 2)
          )
        )
      ) AS distance
    FROM public.stations s
  )
  SELECT 
    b.id,
    b.name,
    b.address,
    b.latitude,
    b.longitude,
    b.type,
    b.distance,
    lp.price AS latest_price
  FROM base b
  LEFT JOIN LATERAL (
    SELECT dp.price
    FROM public.daily_prices dp
    WHERE dp.station_id = b.id
    ORDER BY dp.as_of_date DESC, dp.created_at DESC
    LIMIT 1
  ) lp ON true
  WHERE b.distance <= radius_km
  ORDER BY b.distance ASC;
$function$;