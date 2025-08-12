-- Fix security linter: set immutable search_path for functions
CREATE OR REPLACE FUNCTION public.get_stations_for_map()
RETURNS TABLE (
  id UUID,
  name TEXT,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  type TEXT,
  latest_price DOUBLE PRECISION
)
SET search_path = public, pg_temp
AS $$
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
)
SET search_path = public, pg_temp
AS $$
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