
import React from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin } from 'lucide-react';

interface LocationInputProps {
  onLocationSubmit: (location: string) => void;
  onUseCurrentLocation: () => void;
}

const LocationInput = ({ onLocationSubmit, onUseCurrentLocation }: LocationInputProps) => {
  const [location, setLocation] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLocationSubmit(location);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto">
      <div className="relative flex items-center">
        <Input
          type="text"
          placeholder="Enter location or address"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="pr-24 backdrop-blur-sm bg-white/90"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onUseCurrentLocation}
          className="absolute right-2 flex items-center text-emerald-600 hover:text-emerald-700"
        >
          <MapPin className="w-4 h-4 mr-1" />
          Current
        </Button>
      </div>
    </form>
  );
};

export default LocationInput;
