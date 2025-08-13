import { useState } from 'react';
import { Button } from './ui/button';
import { useToast } from './ui/use-toast';
import { importStationsFromSheet } from '../utils/importStations';
import { Upload } from 'lucide-react';

export function ImportButton() {
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();

  const handleImport = async () => {
    setIsImporting(true);
    
    try {
      const result = await importStationsFromSheet();
      
      if (result.success) {
        toast({
          title: "Import Successful",
          description: `Imported ${result.count} stations from Sheet1.json`,
        });
        
        // Refresh the page to show new stations
        window.location.reload();
      } else {
        throw new Error(result.error?.message || 'Import failed');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Button
      onClick={handleImport}
      disabled={isImporting}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      <Upload className="h-4 w-4" />
      {isImporting ? 'Importing...' : 'Import Stations'}
    </Button>
  );
}