
import React from 'react';
import { Card } from "@/components/ui/card";
import { Fuel, Plug, MapPin } from 'lucide-react';

interface StationCardProps {
  name: string;
  distance: string;
  price: number;
  type: 'fuel' | 'electric';
  address: string;
}

const StationCard = ({ name, distance, price, type, address }: StationCardProps) => {
  return (
    <Card className="w-full p-4 backdrop-blur-sm bg-white/90 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 animate-fade-in">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          {type === 'fuel' ? (
            <div className="p-2 rounded-full bg-emerald-50">
              <Fuel className="w-5 h-5 text-emerald-600" />
            </div>
          ) : (
            <div className="p-2 rounded-full bg-blue-50">
              <Plug className="w-5 h-5 text-blue-600" />
            </div>
          )}
          <div>
            <h3 className="font-semibold text-gray-900">{name}</h3>
            <div className="flex items-center text-sm text-gray-500">
              <MapPin className="w-4 h-4 mr-1" />
              <span>{distance}</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-gray-900">
            {price ? (
              `$${price.toFixed(2)}`
            ) : (
              <span className="text-gray-400">N/A</span>
            )}
          </div>
          <div className="text-sm text-gray-500">
            {type === 'fuel' ? 'per gallon' : 'per kWh'}
          </div>
        </div>
      </div>
      <p className="mt-2 text-sm text-gray-600">{address}</p>
    </Card>
  );
};

export default StationCard;
