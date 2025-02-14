
import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from "@/integrations/supabase/client";
import type { Database } from '@/integrations/supabase/types';

type Station = Database['public']['Functions']['get_stations_for_map']['Returns'][0];

const Map = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    let isMounted = true;

    const fetchStations = async () => {
      const { data: stations, error } = await supabase.rpc('get_stations_for_map');
      if (error) {
        console.error('Error fetching stations:', error);
        return;
      }
      return stations;
    };

    const initializeMap = async () => {
      if (!mapContainer.current || map.current) return;

      try {
        const { data: { MAPBOX_TOKEN }, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error || !MAPBOX_TOKEN) {
          console.error('Error getting Mapbox token:', error);
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

          map.current = newMap;

          // Add navigation controls
          newMap.addControl(new mapboxgl.NavigationControl(), 'top-right');

          // Load stations and add markers
          const stations = await fetchStations();
          if (!stations || !isMounted) return;

          stations.forEach((station: Station) => {
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
              .addTo(newMap);
              
            markers.current.push(marker);
          });
        });
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

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

  return (
    <div className="relative w-full h-[400px] rounded-lg overflow-hidden shadow-lg">
      <div ref={mapContainer} className="absolute inset-0" />
    </div>
  );
};

export default Map;
