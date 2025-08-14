
import React, { useState } from 'react';
import LocationInput from '../components/LocationInput';
import FilterBar from '../components/FilterBar';
import StationCard from '../components/StationCard';
import Map from '../components/Map';
import { ImportButton } from '../components/ImportButton';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
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
  const [showOverlay, setShowOverlay] = useState(true);

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
    <div className="relative w-full h-screen overflow-hidden">
      {/* Full-screen Map Background */}
      <Map activeFilter={filter} />
      
      {/* Toggle Button */}
      <Button
        onClick={() => setShowOverlay(!showOverlay)}
        className="fixed top-4 right-4 z-50 rounded-full w-12 h-12 p-0 bg-white/90 hover:bg-white text-gray-900 shadow-lg border"
        variant="ghost"
      >
        {showOverlay ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Overlay Panel */}
      {showOverlay && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          <div className="absolute left-4 top-4 bottom-4 w-96 max-w-[calc(100vw-2rem)] pointer-events-auto">
            <div className="h-full bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border overflow-y-auto">
              <div className="p-6 space-y-6">
                {/* Header */}
                <div className="text-center space-y-2">
                  <h1 className="text-2xl font-bold text-gray-900">Find Nearby Stations</h1>
                  <p className="text-sm text-gray-600">Discover the best prices for fuel and charging stations</p>
                </div>

                {/* Location Input */}
                <LocationInput
                  onLocationSubmit={handleLocationSubmit}
                  onUseCurrentLocation={handleUseCurrentLocation}
                />

                {/* Filter and Import */}
                <div className="flex flex-col gap-4">
                  <FilterBar
                    activeFilter={filter}
                    onFilterChange={setFilter}
                  />
                  <ImportButton />
                </div>

                {/* Results */}
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
                    <p className="mt-4 text-sm text-gray-600">Finding stations...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
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
                      <div className="text-center py-6">
                        <p className="text-sm text-gray-600">No stations found in this area</p>
                      </div>
                    )}
                    {!coordinates && (
                      <div className="text-center py-6">
                        <p className="text-sm text-gray-600">Enter a location to find stations</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
