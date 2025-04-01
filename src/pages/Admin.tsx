
import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText, Check, AlertCircle } from "lucide-react";

const Admin = () => {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if it's a CSV file
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast({
        variant: "destructive",
        title: "Invalid file",
        description: "Please upload a CSV file.",
      });
      return;
    }

    try {
      setIsUploading(true);
      setResults(null);

      // Read the file
      const csvData = await readFileAsText(file);

      // Upload to the Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('import-stations', {
        body: { csvData },
      });

      if (error) {
        throw new Error(`Function error: ${error.message}`);
      }

      setResults(data);

      // Show success message
      toast({
        title: "Import Completed",
        description: `Successfully imported ${data.successful} out of ${data.total} stations.`,
      });

      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Import error:', error);
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: error.message || "Failed to import stations.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target?.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  };

  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-4 mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">Manage your station data</p>
        </div>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold mb-4">Import Stations</h2>
          <p className="text-gray-600 mb-6">
            Upload a CSV file with station data. The CSV should include the following columns: name, address, latitude, longitude, type (fuel or electric), and price (optional).
          </p>

          <div className="flex items-center space-x-4 mb-6">
            <Button
              onClick={handleClickUpload}
              disabled={isUploading}
              className="flex items-center space-x-2"
            >
              {isUploading ? (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
              ) : (
                <Upload size={16} className="mr-2" />
              )}
              {isUploading ? "Uploading..." : "Upload CSV"}
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv"
              className="hidden"
            />
            
            <div className="text-sm text-gray-500">
              <FileText size={16} className="inline mr-1" />
              <a 
                href="data:text/csv;charset=utf-8,name,address,latitude,longitude,type,price%0AExample Station,123 Main St,10.8505,76.2711,fuel,95.50%0ACharging Point,456 Oak Ave,10.85,76.28,electric,4.25"
                download="station_template.csv"
                className="text-blue-600 hover:underline"
              >
                Download template
              </a>
            </div>
          </div>

          {results && (
            <div className="mt-8">
              <h3 className="text-xl font-semibold mb-4">Import Results</h3>
              <div className="flex items-center space-x-8 mb-6">
                <div>
                  <div className="text-2xl font-bold">{results.total}</div>
                  <div className="text-sm text-gray-600">Total Stations</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{results.successful}</div>
                  <div className="text-sm text-gray-600">Imported Successfully</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{results.failed}</div>
                  <div className="text-sm text-gray-600">Failed</div>
                </div>
              </div>

              {results.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2">Errors</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Station</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.errors.map((error, index) => (
                        <TableRow key={index}>
                          <TableCell>{error.station}</TableCell>
                          <TableCell className="text-red-600">{error.error}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Admin;
