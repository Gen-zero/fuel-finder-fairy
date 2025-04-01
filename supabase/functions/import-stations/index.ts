
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Create Supabase client using environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseServiceRole) {
      throw new Error('Missing environment variables for Supabase');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceRole);
    
    // Only accept POST requests
    if (req.method !== 'POST') {
      throw new Error('This endpoint only accepts POST requests');
    }
    
    // Parse the request body
    const contentType = req.headers.get('content-type') || '';
    
    if (!contentType.includes('application/json')) {
      throw new Error('Request must be JSON');
    }
    
    const { csvData } = await req.json();
    
    if (!csvData || typeof csvData !== 'string') {
      throw new Error('CSV data is required');
    }
    
    // Process the CSV data
    const stations = parseCSV(csvData);
    
    if (stations.length === 0) {
      throw new Error('No valid stations found in CSV');
    }
    
    console.log(`Importing ${stations.length} stations...`);
    
    // Insert stations and record success/failures
    const results = await importStations(supabase, stations);
    
    return new Response(
      JSON.stringify(results),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in import-stations function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

// Parse CSV string to array of station objects
function parseCSV(csvString: string) {
  const lines = csvString.trim().split('\n');
  
  // Extract header line and remaining data lines
  const headers = lines[0].split(',').map(header => header.trim());
  const dataLines = lines.slice(1);
  
  // Map required fields to their positions in the CSV
  const nameIndex = headers.findIndex(h => h.toLowerCase() === 'name');
  const addressIndex = headers.findIndex(h => h.toLowerCase() === 'address');
  const latitudeIndex = headers.findIndex(h => h.toLowerCase() === 'latitude');
  const longitudeIndex = headers.findIndex(h => h.toLowerCase() === 'longitude');
  const typeIndex = headers.findIndex(h => h.toLowerCase() === 'type');
  const priceIndex = headers.findIndex(h => h.toLowerCase() === 'price');
  
  // Ensure all required fields are present
  const requiredFields = [
    { name: 'name', index: nameIndex },
    { name: 'address', index: addressIndex },
    { name: 'latitude', index: latitudeIndex },
    { name: 'longitude', index: longitudeIndex },
    { name: 'type', index: typeIndex }
  ];
  
  const missingFields = requiredFields
    .filter(field => field.index === -1)
    .map(field => field.name);
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields in CSV: ${missingFields.join(', ')}`);
  }
  
  // Parse each data line
  return dataLines.map((line, lineIndex) => {
    // Handle comma in quoted values correctly (simple implementation)
    const values: string[] = [];
    let currentValue = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    
    // Add the last value
    values.push(currentValue.trim());
    
    // Extract values from the parsed line
    const name = values[nameIndex];
    const address = values[addressIndex];
    const latitude = parseFloat(values[latitudeIndex]);
    const longitude = parseFloat(values[longitudeIndex]);
    const type = values[typeIndex].toLowerCase();
    const price = priceIndex !== -1 && values[priceIndex] 
      ? parseFloat(values[priceIndex]) 
      : null;
    
    // Validate values
    if (!name || !address) {
      throw new Error(`Line ${lineIndex + 2}: Name and address are required`);
    }
    
    if (isNaN(latitude) || isNaN(longitude)) {
      throw new Error(`Line ${lineIndex + 2}: Invalid latitude or longitude`);
    }
    
    if (type !== 'fuel' && type !== 'electric') {
      throw new Error(`Line ${lineIndex + 2}: Type must be either "fuel" or "electric"`);
    }
    
    if (price !== null && isNaN(price)) {
      throw new Error(`Line ${lineIndex + 2}: Invalid price value`);
    }
    
    return {
      name,
      address,
      latitude,
      longitude,
      type,
      price
    };
  });
}

// Import stations to the database
async function importStations(supabase, stations) {
  const results = {
    total: stations.length,
    successful: 0,
    failed: 0,
    errors: [],
    stationIds: []
  };
  
  // Process each station
  for (const station of stations) {
    try {
      // Insert the station
      const { data: stationData, error: stationError } = await supabase
        .from('stations')
        .insert({
          name: station.name,
          address: station.address,
          latitude: station.latitude,
          longitude: station.longitude,
          type: station.type,
        })
        .select('id')
        .single();
      
      if (stationError) {
        throw stationError;
      }
      
      // Insert the price if available
      if (station.price !== null) {
        const { error: priceError } = await supabase
          .from('prices')
          .insert({
            station_id: stationData.id,
            price: station.price,
          });
        
        if (priceError) {
          throw priceError;
        }
      }
      
      results.successful++;
      results.stationIds.push(stationData.id);
    } catch (error) {
      results.failed++;
      results.errors.push({
        station: station.name,
        error: error.message
      });
    }
  }
  
  return results;
}
