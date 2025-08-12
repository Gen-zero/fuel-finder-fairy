
import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from "@/integrations/supabase/client";
type Station = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  type: 'fuel' | 'electric';
  latest_price: number | null;
};

interface MapProps {
  activeFilter: 'all' | 'fuel' | 'electric';
}

const Map = ({ activeFilter }: MapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stationsData, setStationsData] = useState<Station[]>([]);

  const renderMarkers = (filter: 'all' | 'fuel' | 'electric', data?: Station[]) => {
    if (!map.current) return;

    // Clear previous markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    const base = (data ?? stationsData) || [];
    const filtered = filter === 'all' ? base : base.filter((s) => s.type === filter);

    filtered.forEach((station: Station) => {
      const color = station.type === 'fuel' ? '#10b981' : '#3b82f6';

      const el = document.createElement('div');
      el.className = 'marker';
      el.style.backgroundColor = color;
      el.style.width = '20px';
      el.style.height = '20px';
      el.style.borderRadius = '50%';
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';

      const marker = new mapboxgl.Marker(el)
        .setLngLat([station.longitude, station.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`
                    <div class="p-2">
                      <h3 class="font-bold">${station.name}</h3>
                      <p class="text-sm text-gray-600">${station.address}</p>
                      <p class="text-sm font-semibold mt-1">
                        ${station.latest_price ? `₹${station.latest_price.toFixed(2)}` : 'Price N/A'}
                      </p>
                    </div>
                  `)
        )
        .addTo(map.current!);

      markers.current.push(marker);
    });
  };
 

  useEffect(() => {
    let isMounted = true;

    const fetchStations = async (): Promise<Station[] | null> => {
      try {
        const { data: stations, error } = await supabase.rpc('get_stations_for_map');
        if (error) {
          console.error('Error fetching stations:', error);
          throw error;
        }
        const typed = (stations ?? []).map((s: any) => ({
          ...s,
          type: s.type === 'electric' ? 'electric' : 'fuel',
          latest_price: s.latest_price ?? null,
        })) as Station[];
        if (isMounted) setStationsData(typed);
        return typed;
      } catch (err) {
        console.error('Failed to fetch stations:', err);
        if (isMounted) setError('Failed to load station data');
        return null;
      }
    };

    const initializeMap = async () => {
      if (!mapContainer.current || map.current) return;

      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        
        if (error || !data || !data.token) {
          console.error('Error getting Mapbox token:', error || 'No token in response');
          if (isMounted) setError('Could not load map: Token error');
          return;
        }

        const MAPBOX_TOKEN = data.token;

        // Verify this is a public token (should start with 'pk.')
        if (!MAPBOX_TOKEN.startsWith('pk.')) {
          console.error('Invalid Mapbox token: Must be a public token');
          if (isMounted) setError('Invalid Mapbox token type. Must use a public token (pk.*)');
          return;
        }

        mapboxgl.accessToken = MAPBOX_TOKEN;

        const newMap = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [76.2711, 10.8505], // Kerala's center coordinates
          zoom: 7,
          minZoom: 5, // Prevent zooming out too far
          maxZoom: 15, // Prevent zooming in too far
        });

        // Wait for map to load before adding features
        newMap.on('load', async () => {
          if (!isMounted) return;
          
          if (isMounted) setLoading(false);
          map.current = newMap;

          // Add navigation controls
          newMap.addControl(new mapboxgl.NavigationControl(), 'top-right');

          // Load stations and add markers
          const stations = await fetchStations();
          if (!stations || !isMounted) return;

          // Ensure local state is in sync
          setStationsData(stations);

          // Render markers according to active filter
          renderMarkers(activeFilter, stations);
        });

        // Handle load error
        newMap.on('error', (e) => {
          console.error('Mapbox error:', e);
          if (isMounted) setError('Error loading map');
        });

      } catch (err) {
        console.error('Error initializing map:', err);
        if (isMounted) {
          setLoading(false);
          setError('Failed to initialize map');
        }
      }
    };

    setLoading(true);
    initializeMap();

    return () => {
      isMounted = false;
      markers.current.forEach(marker => marker.remove());
      markers.current = [];
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (map.current && stationsData.length) {
      renderMarkers(activeFilter);
    }
  }, [activeFilter, stationsData]);

  return (
    <div className="relative w-full h-[400px] rounded-lg overflow-hidden shadow-lg">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-10">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="text-center p-4">
            <p className="text-destructive font-medium">{error}</p>
            <p className="text-sm text-gray-500 mt-2">Please check your Mapbox token configuration.</p>
          </div>
        </div>
      )}
      
      <div ref={mapContainer} className="absolute inset-0" />
    </div>
  );
};

export default Map;
