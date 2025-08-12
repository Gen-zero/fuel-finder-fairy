-- Enable required extension for UUIDs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Tables
CREATE TABLE IF NOT EXISTS public.stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('fuel','electric')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  price DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Indexes
CREATE INDEX IF NOT EXISTS idx_stations_type ON public.stations (type);
CREATE INDEX IF NOT EXISTS idx_stations_lat_lng ON public.stations (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_prices_station_created_at ON public.prices (station_id, created_at DESC);

-- 3) RLS (public read-only access)
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='stations' AND policyname='Public read stations'
  ) THEN
    CREATE POLICY "Public read stations" ON public.stations
    FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='prices' AND policyname='Public read prices'
  ) THEN
    CREATE POLICY "Public read prices" ON public.prices
    FOR SELECT USING (true);
  END IF;
END$$;

-- 4) RPC: get_stations_for_map
CREATE OR REPLACE FUNCTION public.get_stations_for_map()
RETURNS TABLE (
  id UUID,
  name TEXT,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  type TEXT,
  latest_price DOUBLE PRECISION
) AS $$
  SELECT 
    s.id,
    s.name,
    s.address,
    s.latitude,
    s.longitude,
    s.type,
    lp.price AS latest_price
  FROM public.stations s
  LEFT JOIN LATERAL (
    SELECT p.price
    FROM public.prices p
    WHERE p.station_id = s.id
    ORDER BY p.created_at DESC
    LIMIT 1
  ) lp ON true;
$$ LANGUAGE sql STABLE;

-- 5) RPC: find_nearby_stations
-- Haversine distance in KM
CREATE OR REPLACE FUNCTION public.find_nearby_stations(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  type TEXT,
  distance DOUBLE PRECISION,
  latest_price DOUBLE PRECISION
) AS $$
  WITH base AS (
    SELECT 
      s.id,
      s.name,
      s.address,
      s.latitude,
      s.longitude,
      s.type,
      (
        6371 * 2 * ASIN(
          SQRT(
            POWER(SIN(RADIANS((lat - s.latitude)) / 2), 2) +
            COS(RADIANS(lat)) * COS(RADIANS(s.latitude)) *
            POWER(SIN(RADIANS((lng - s.longitude)) / 2), 2)
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
    SELECT p.price
    FROM public.prices p
    WHERE p.station_id = b.id
    ORDER BY p.created_at DESC
    LIMIT 1
  ) lp ON true
  WHERE b.distance <= radius_km
  ORDER BY b.distance ASC;
$$ LANGUAGE sql STABLE;
