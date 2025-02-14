
import React, { useState } from 'react';
import LocationInput from '../components/LocationInput';
import FilterBar from '../components/FilterBar';
import StationCard from '../components/StationCard';
import { useToast } from "@/hooks/use-toast";

// Dummy data for demonstration
const MOCK_STATIONS = [
  {
    id: 1,
    name: "Shell Station",
    distance: "0.3 miles",
    price: 3.99,
    type: "fuel" as const,
    address: "123 Main St, City, State"
  },
  {
    id: 2,
    name: "Tesla Supercharger",
    distance: "0.5 miles",
    price: 0.40,
    type: "electric" as const,
    address: "456 Electric Ave, City, State"
  },
  {
    id: 3,
    name: "Chevron",
    distance: "0.7 miles",
    price: 3.89,
    type: "fuel" as const,
    address: "789 Gas Lane, City, State"
  },
];

const Index = () => {
  const { toast } = useToast();
  const [filter, setFilter] = useState<'all' | 'fuel' | 'electric'>('all');
  const [stations, setStations] = useState(MOCK_STATIONS);

  const handleLocationSubmit = (location: string) => {
    toast({
      title: "Location updated",
      description: `Searching for stations near ${location}`,
    });
    // In a real app, this would fetch stations based on the location
  };

  const handleUseCurrentLocation = () => {
    toast({
      title: "Accessing location",
      description: "Finding your current location...",
    });
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          toast({
            title: "Location found",
            description: "Searching for nearby stations...",
          });
          // In a real app, this would fetch stations based on coordinates
        },
        () => {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Unable to access your location",
          });
        }
      );
    }
  };

  const filteredStations = stations.filter(station => 
    filter === 'all' ? true : station.type === filter
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-4 mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Find Nearby Stations</h1>
          <p className="text-gray-600">Discover the best prices for fuel and charging stations near you</p>
        </div>

        <LocationInput
          onLocationSubmit={handleLocationSubmit}
          onUseCurrentLocation={handleUseCurrentLocation}
        />

        <FilterBar
          activeFilter={filter}
          onFilterChange={setFilter}
        />

        <div className="space-y-4">
          {filteredStations.map((station) => (
            <StationCard
              key={station.id}
              name={station.name}
              distance={station.distance}
              price={station.price}
              type={station.type}
              address={station.address}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Index;
