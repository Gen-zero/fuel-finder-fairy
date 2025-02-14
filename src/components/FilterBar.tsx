
import React from 'react';
import { Button } from "@/components/ui/button";
import { Fuel, Plug } from 'lucide-react';

interface FilterBarProps {
  activeFilter: 'all' | 'fuel' | 'electric';
  onFilterChange: (filter: 'all' | 'fuel' | 'electric') => void;
}

const FilterBar = ({ activeFilter, onFilterChange }: FilterBarProps) => {
  return (
    <div className="flex items-center justify-center space-x-2 my-4 animate-fade-in">
      <Button
        variant={activeFilter === 'all' ? "default" : "outline"}
        onClick={() => onFilterChange('all')}
        className="transition-all duration-300"
      >
        All
      </Button>
      <Button
        variant={activeFilter === 'fuel' ? "default" : "outline"}
        onClick={() => onFilterChange('fuel')}
        className="transition-all duration-300"
      >
        <Fuel className="w-4 h-4 mr-2" />
        Gas
      </Button>
      <Button
        variant={activeFilter === 'electric' ? "default" : "outline"}
        onClick={() => onFilterChange('electric')}
        className="transition-all duration-300"
      >
        <Plug className="w-4 h-4 mr-2" />
        Electric
      </Button>
    </div>
  );
};

export default FilterBar;
