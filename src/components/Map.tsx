
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

      const { data: { MAPBOX_TOKEN }, error } = await supabase.functions.invoke('get-mapbox-token');
      if (error) {
        console.error('Error getting Mapbox token:', error);
        return;
      }

      mapboxgl.accessToken = MAPBOX_TOKEN;
      
      // Initialize map centered on Kerala
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [76.2711, 10.8505], // Kerala's center coordinates
        zoom: 7,
      });

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Load stations and add markers
      const stations = await fetchStations();
      if (!stations) return;

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
          .addTo(map.current);
          
        markers.current.push(marker);
      });
    };

    initializeMap();

    return () => {
      markers.current.forEach(marker => marker.remove());
      markers.current = [];
      if (map.current) map.current.remove();
    };
  }, []);

  return (
    <div className="relative w-full h-[400px] rounded-lg overflow-hidden shadow-lg">
      <div ref={mapContainer} className="absolute inset-0" />
    </div>
  );
};

export default Map;
