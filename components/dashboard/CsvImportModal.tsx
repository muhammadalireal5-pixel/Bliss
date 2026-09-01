import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Upload, X, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (leads: any[]) => void;
}

export default function CsvImportModal({ isOpen, onClose, onImport }: CsvImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedData, setParsedData] = useState<any[]>([]);
  
  const [nameCol, setNameCol] = useState<string>('');
  const [emailCol, setEmailCol] = useState<string>('');
  
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFile(file);
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.meta.fields) {
            setHeaders(results.meta.fields);
            
            // Auto-guess columns
            const nameMatch = results.meta.fields.find(f => f.toLowerCase().includes('name'));
            const emailMatch = results.meta.fields.find(f => f.toLowerCase().includes('email'));
            if (nameMatch) setNameCol(nameMatch);
            if (emailMatch) setEmailCol(emailMatch);
          }
          setParsedData(results.data);
        }
      });
    }
  };

  const handleProcess = async () => {
    if (!nameCol || !emailCol) return;
    
    setLoading(true);
    
    const leads = parsedData.map(row => ({
      name: row[nameCol],
      email: row[emailCol]
    })).filter(l => l.name && l.email);

    try {
      const res = await fetch('/api/import-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads })
      });
      const data = await res.json();
      if (res.ok) {
        onImport(data.leads);
        onClose();
      } else {
        console.error(data.error);
        alert('Failed to import leads');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to import leads');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        
        <div className="flex justify-between items-center p-5 border-b border-slate-100 shrink-0">
          <h2 className="text-lg font-bold text-slate-900">Import Leads from CSV</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {!file ? (
            <div 
              className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="p-3 bg-primary/20 text-primary rounded-full mb-3">
                <Upload size={24} />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Click to upload CSV</h3>
              <p className="text-xs text-slate-500 mt-1">Up to 50 rows supported per import</p>
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded">
                    <Check size={14} strokeWidth={3} />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 truncate">{file.name}</span>
                </div>
                <span className="text-xs text-slate-500 font-medium bg-white px-2 py-1 border border-slate-200 rounded">{parsedData.length} rows</span>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Map Columns</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Name Column</label>
                    <select 
                      className="w-full text-sm bg-white border border-slate-200 rounded-lg p-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      value={nameCol}
                      onChange={e => setNameCol(e.target.value)}
                    >
                      <option value="">Select column...</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Email Column</label>
                    <select 
                      className="w-full text-sm bg-white border border-slate-200 rounded-lg p-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      value={emailCol}
                      onChange={e => setEmailCol(e.target.value)}
                    >
                      <option value="">Select column...</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-100 bg-slate-50 shrink-0 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleProcess}
            disabled={!file || !nameCol || !emailCol || loading}
            loading={loading}
            icon={<ArrowRight size={16} />}
          >
            Import & Validate
          </Button>
        </div>
      </div>
    </div>
  );
}
