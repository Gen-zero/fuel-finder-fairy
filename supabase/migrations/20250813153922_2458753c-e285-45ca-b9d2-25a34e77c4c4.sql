-- Add INSERT policy for stations table to allow importing data
CREATE POLICY "Public insert stations" 
ON public.stations 
FOR INSERT 
WITH CHECK (true);

-- Also add INSERT policy for daily_prices table in case we need it later
CREATE POLICY "Public insert daily_prices" 
ON public.daily_prices 
FOR INSERT 
WITH CHECK (true);