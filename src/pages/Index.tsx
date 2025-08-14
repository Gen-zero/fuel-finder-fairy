
import React, { useState } from 'react';
import LocationInput from '../components/LocationInput';
import FilterBar from '../components/FilterBar';
import StationCard from '../components/StationCard';
import Map from '../components/Map';
import { ImportButton } from '../components/ImportButton';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from '@tanstack/react-query';
// Local Station type to avoid dependency on generated Supabase types
type Station = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  type: 'fuel' | 'electric';
  distance: number;
  latest_price: number | null;
};

const Index = () => {
  const { toast } = useToast();
  const [filter, setFilter] = useState<'all' | 'fuel' | 'electric'>('fuel');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  const { data: stations = [], isLoading } = useQuery({
    queryKey: ['stations', coordinates?.lat, coordinates?.lng, filter],
    queryFn: async () => {
      if (!coordinates) return [];
      
      const { data, error } = await supabase
        .rpc('find_nearby_stations', {
          lat: coordinates.lat,
          lng: coordinates.lng,
          radius_km: 250 // Increased radius to cover Kerala's area
        });

      if (error) {
        console.error('Error fetching stations:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch nearby stations",
        });
        return [];
      }

      return data as Station[];
    },
    enabled: !!coordinates,
  });

  const handleLocationSubmit = async (location: string) => {
    if (!location.trim()) return;
    
    toast({
      title: "Location update",
      description: `Searching for stations near ${location}`,
    });
    
    try {
      // Get Mapbox token from Supabase edge function
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-mapbox-token');
      
      if (tokenError || !tokenData?.token) {
        throw new Error('Unable to get Mapbox token');
      }
      
      // Use Mapbox Geocoding API to convert location string to coordinates
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?access_token=${tokenData.token}&country=IN&limit=1`
      );
      
      if (!response.ok) {
        throw new Error('Geocoding failed');
      }
      
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        setCoordinates({ lat, lng });
        toast({
          title: "Location found",
          description: `Searching for stations near ${data.features[0].place_name}`,
        });
      } else {
        throw new Error('Location not found');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Unable to find location. Please try a different search term.",
      });
    }
  };

  const handleUseCurrentLocation = () => {
    toast({
      title: "Accessing location",
      description: "Finding your current location...",
    });

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoordinates({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          toast({
            title: "Location found",
            description: "Searching for nearby stations...",
          });
        },
        (error) => {
          let errorMessage = "Unable to access your location";
          
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Location access denied. Please enable location permissions in your browser.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Location information unavailable.";
              break;
            case error.TIMEOUT:
              errorMessage = "Location request timed out.";
              break;
          }
          
          toast({
            variant: "destructive",
            title: "Location Error",
            description: errorMessage,
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        }
      );
    } else {
      toast({
        variant: "destructive",
        title: "Geolocation not supported",
        description: "Your browser doesn't support location services.",
      });
    }
  };

  const filteredStations = stations.filter(station => 
    filter === 'all' ? true : station.type === filter
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-4 mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Find Nearby Stations</h1>
          <p className="text-gray-600">Discover the best prices for fuel and charging stations in Kerala</p>
        </div>

        <Map activeFilter={filter} />

        <LocationInput
          onLocationSubmit={handleLocationSubmit}
          onUseCurrentLocation={handleUseCurrentLocation}
        />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <FilterBar
            activeFilter={filter}
            onFilterChange={setFilter}
          />
          <ImportButton />
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-gray-600">Finding stations in Kerala...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredStations.map((station) => (
              <StationCard
                key={station.id}
                name={station.name}
                distance={`${station.distance.toFixed(1)} km`}
                price={station.latest_price || 0}
                type={station.type}
                address={station.address}
              />
            ))}
            {filteredStations.length === 0 && coordinates && (
              <div className="text-center py-8">
                <p className="text-gray-600">No stations found in this area</p>
              </div>
            )}
            {!coordinates && (
              <div className="text-center py-8">
                <p className="text-gray-600">Enter a location or use your current location to find stations</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
