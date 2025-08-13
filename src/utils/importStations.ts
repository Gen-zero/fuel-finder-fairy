import { supabase } from "@/integrations/supabase/client";
import stationsData from "../Sheet1.json";

interface SheetStation {
  "Station Name": string;
  "Location": string;
  "Coordinates": string;
}

export async function importStationsFromSheet() {
  try {
    const stations = stationsData.map((station: SheetStation, index: number) => {
      const [lat, lng] = station.Coordinates.split(', ').map(coord => parseFloat(coord.trim()));
      
      // Determine station type and provider
      let provider = 'Unknown';
      let stationType = 'petrol'; // Default to petrol
      
      if (station["Station Name"].toLowerCase().includes('jiobp') || station["Station Name"].toLowerCase().includes('jio-bp')) {
        provider = 'JioBP';
      } else if (station["Station Name"].toLowerCase().includes('indianoil')) {
        provider = 'Indian Oil';
      } else if (station["Station Name"].toLowerCase().includes('bpcl') || station["Station Name"].toLowerCase().includes('bharat petroleum')) {
        provider = 'BPCL';
      } else if (station["Station Name"].toLowerCase().includes('hpcl')) {
        provider = 'HPCL';
      }
      
      return {
        station_id: `SHEET_${index + 1}`,
        source: 'MANUAL',
        station_type: stationType,
        provider,
        name: station["Station Name"],
        address: station["Location"],
        city: extractCity(station["Location"]),
        state: 'Kerala',
        lat,
        lng,
        meta: {
          imported_from: 'Sheet1.json',
          original_index: index
        }
      };
    });

    // Insert stations in batches
    const batchSize = 50;
    let inserted = 0;
    
    for (let i = 0; i < stations.length; i += batchSize) {
      const batch = stations.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('stations')
        .upsert(batch, { 
          onConflict: 'station_id',
          ignoreDuplicates: false 
        });
      
      if (error) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
        throw error;
      }
      
      inserted += batch.length;
      console.log(`Inserted batch ${i / batchSize + 1}: ${batch.length} stations`);
    }
    
    console.log(`Successfully imported ${inserted} stations from Sheet1.json`);
    return { success: true, count: inserted };
    
  } catch (error) {
    console.error('Error importing stations:', error);
    return { success: false, error };
  }
}

function extractCity(address: string): string {
  // Simple city extraction logic for Kerala addresses
  const cityPatterns = [
    /Kochi|Ernakulam/i,
    /Thiruvananthapuram/i,
    /Kozhikode|Calicut/i,
    /Thrissur/i,
    /Kollam/i,
    /Kannur/i,
    /Palakkad/i,
    /Kottayam/i,
    /Alappuzha/i,
    /Kasaragod/i,
    /Malappuram/i,
    /Wayanad/i,
    /Idukki/i,
    /Pathanamthitta/i
  ];
  
  for (const pattern of cityPatterns) {
    const match = address.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  // Fallback: try to extract city from comma-separated address
  const parts = address.split(',').map(part => part.trim());
  if (parts.length >= 2) {
    return parts[parts.length - 3] || 'Unknown';
  }
  
  return 'Unknown';
}