'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { getLocalSubmissions, getLocalFields, PatientSubmission, FormField, saveLocalSubmissions, deleteLocalSubmission } from '@/lib/db';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSync } from '@/lib/SyncContext';
import { 
  Search, 
  Filter, 
  Printer, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  ArrowUpDown, 
  FileSpreadsheet, 
  FileText, 
  DownloadCloud,
  X,
  FileCode,
  Calendar,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Export Libraries
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/** Flat, typed representation of one processed patient record used across filters and exports. */
interface ProcessedRecord {
  id: string;
  created_at: string;
  synced: number;
  _raw: import('@/lib/db').PatientSubmission;
  _age: number | null;
  [fieldId: string]: string | number | null | import('@/lib/db').PatientSubmission;
}

export default function AdminDashboard() {
  const { isOnline } = useSync();
  const [fields, setFields] = useState<FormField[]>([]);
  const [submissions, setSubmissions] = useState<PatientSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgeRange, setSelectedAgeRange] = useState('all');
  const [selectedDate, setSelectedDate] = useState('');
  const [customFilters, setCustomFilters] = useState<Record<string, string>>({});
  const [sortField, setSortField] = useState<'created_at' | string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Selected Patient Details Drawer
  const [selectedSubmission, setSelectedSubmission] = useState<PatientSubmission | null>(null);

  // Sync state for pulling remote data
  const [pullingRemote, setPullingRemote] = useState(false);

  // Deletion logic
  const handleDeleteRecord = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this record? This action cannot be undone.')) return;

    try {
      // 1. Delete from Supabase if configured and online
      if (isOnline && isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('submissions').delete().eq('id', id);
        if (error) {
          console.error("Failed to delete from remote DB:", error);
          alert("Could not delete from cloud. Are you offline?");
          return;
        }
      }

      // 2. Delete locally
      await deleteLocalSubmission(id);

      // 3. Update state to reflect deletion immediately
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
      setSelectedSubmission(null);
    } catch (err) {
      console.error("Error deleting record:", err);
      alert("Error occurred while trying to delete the record.");
    }
  };

  // 1. Fetch Local Data and attempt to sync from Supabase if online
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const localFields = await getLocalFields();
      setFields(localFields);

      // Load local cache submissions
      const localSubs = await getLocalSubmissions();
      setSubmissions(localSubs);

      // If online and Supabase is configured, pull latest remote submissions to cache
      if (isOnline && isSupabaseConfigured && supabase) {
        setPullingRemote(true);
        try {
          // Fetch submissions
          const { data: subData, error: subError } = await supabase
            .from('submissions')
            .select('*')
            .order('created_at', { ascending: false });

          if (subError) throw subError;

          if (subData && subData.length > 0) {
            // Fetch values
            const { data: valData, error: valError } = await supabase
              .from('submission_values')
              .select('*');

            if (valError) throw valError;

            // Reconstruct submission object structure
            const remoteSubmissions: PatientSubmission[] = subData.map((s: Record<string, string>) => {
              const valuesMap: Record<string, string> = {};
              (valData || [])
                .filter((v: Record<string, string>) => v.submission_id === s.id)
                .forEach((v: Record<string, string>) => {
                  valuesMap[v.field_id] = v.value;
                });

              return {
                id: s.id,
                created_at: s.created_at,
                values: valuesMap,
                synced: 1 // Already synced
              };
            });

            // Cache in IndexedDB
            await saveLocalSubmissions(remoteSubmissions);
            
            // Reload updated set
            const freshSubs = await getLocalSubmissions();
            setSubmissions(freshSubs);
          }
        } catch (pullErr) {
          console.error('Failed to sync remote data to cache:', pullErr);
        } finally {
          setPullingRemote(false);
        }
      }
    } catch (e) {
      console.error('Failed to load dashboard:', e);
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDashboardData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadDashboardData]);

  // 2. Identify custom choices-based fields for dropdown filtering (e.g. Gender, Diagnosis)
  const choiceBasedFields = useMemo(() => {
    return fields.filter((f) => ['select', 'radio', 'checkbox'].includes(f.type));
  }, [fields]);

  // 3. Map submissions into flat filterable record objects
  const processedRecords = useMemo(() => {
    return submissions.map((sub) => {
      const record: ProcessedRecord = {
        id: sub.id,
        created_at: sub.created_at,
        synced: sub.synced,
        _raw: sub,
        _age: null,
      };
      
      // Inject answers mapping
      fields.forEach((field) => {
        record[field.id] = sub.values[field.id] || '';
      });

      // Attempt to calculate age or locate age fields
      const ageField = fields.find((f) => f.label.toLowerCase() === 'age' || f.type === 'number' && f.label.toLowerCase().includes('age'));
      if (ageField) {
        record._age = parseInt(sub.values[ageField.id]) || null;
      }

      return record;
    });
  }, [submissions, fields]);

  // 4. Apply multi-layered filtering
  const filteredRecords = useMemo(() => {
    return processedRecords.filter((rec) => {
      // 4a. Search Query Check
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = fields.some((field) => {
          const val = String(rec[field.id] || '').toLowerCase();
          return val.includes(query);
        });
        if (!matchesSearch && !rec.id.toLowerCase().includes(query)) {
          return false;
        }
      }

      // 4b. Age Range Filtering
      if (selectedAgeRange !== 'all') {
        const age = rec._age;
        if (age === undefined || age === null) return false;
        if (selectedAgeRange === 'child' && age > 12) return false;
        if (selectedAgeRange === 'teen' && (age < 13 || age > 19)) return false;
        if (selectedAgeRange === 'adult' && (age < 20 || age > 59)) return false;
        if (selectedAgeRange === 'senior' && age < 60) return false;
      }

      // 4c. Date Range Filtering (exact day matching)
      if (selectedDate) {
        const recDate = new Date(rec.created_at).toISOString().split('T')[0];
        if (recDate !== selectedDate) return false;
      }

      // 4d. Dynamic Choice Filters (Diagnosis, Gender, etc.)
      for (const [fieldId, filterVal] of Object.entries(customFilters)) {
        if (filterVal) {
          const recVal = String(rec[fieldId] || '');
          // Supports comma-separated multi checkbox answers too
          if (!recVal.includes(filterVal)) return false;
        }
      }

      return true;
    });
  }, [processedRecords, searchQuery, selectedAgeRange, selectedDate, customFilters, fields]);

  // 5. Apply sorting parameters
  const sortedRecords = useMemo(() => {
    const sorted = [...filteredRecords];
    sorted.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle Date Sort — extract as string before passing to Date()
      if (sortField === 'created_at') {
        const aDate = new Date(a.created_at).getTime();
        const bDate = new Date(b.created_at).getTime();
        return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
      }

      // Handle Numbers Sort
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // String sort fallback
      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredRecords, sortField, sortDirection]);

  // 6. Pagination Split
  const paginatedRecords = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return sortedRecords.slice(startIdx, startIdx + itemsPerPage);
  }, [sortedRecords, currentPage]);

  const totalPages = Math.ceil(sortedRecords.length / itemsPerPage);

  const handlePageChange = (pageNum: number) => {
    if (pageNum > 0 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
    }
  };

  const handleSort = (fieldKey: string) => {
    if (sortField === fieldKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(fieldKey);
      setSortDirection('asc');
    }
  };

  const handleCustomFilterChange = (fieldId: string, value: string) => {
    setCustomFilters({ ...customFilters, [fieldId]: value });
    setCurrentPage(1); // Reset page index
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedAgeRange('all');
    setSelectedDate('');
    setCustomFilters({});
    setCurrentPage(1);
  };

  // ================= EXPORT AND PRINT SERVICES =================

  const getExportData = (records: typeof sortedRecords) => {
    // Map internal records object into readable Excel row layout
    return records.map((rec) => {
      const row: Record<string, string> = {
        'Submission ID': rec.id,
        'Registration Date': new Date(rec.created_at).toLocaleString(),
        'Sync Status': rec.synced === 1 ? 'Synced' : 'Local Offline'
      };

      fields.forEach((field) => {
        const rawVal = rec[field.id];
        row[field.label] = rawVal != null ? String(rawVal) : '';
      });

      return row;
    });
  };

  // EXCEL EXPORTER
  const exportToExcel = (scope: 'all' | 'filtered') => {
    const targetSet = scope === 'all' ? processedRecords : sortedRecords;
    if (targetSet.length === 0) return alert('No records available to export.');

    const data = getExportData(targetSet);
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Patient Intakes');

    // Auto-fit Column widths
    const maxKeys = Object.keys(data[0]);
    worksheet['!cols'] = maxKeys.map(() => ({ wch: 18 }));

    XLSX.writeFile(workbook, `MORS_Outreach_Export_${scope}.xlsx`);
  };

  // CSV EXPORTER
  const exportToCSV = (scope: 'all' | 'filtered') => {
    const targetSet = scope === 'all' ? processedRecords : sortedRecords;
    if (targetSet.length === 0) return alert('No records available to export.');

    const data = getExportData(targetSet);
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map((header) => {
        const val = String(row[header] || '').replace(/"/g, '""'); // escape quotes
        return `"${val}"`;
      });
      csvRows.push(values.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `MORS_Outreach_Export_${scope}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // TABULAR PDF EXPORTER
  const exportToPDF = (scope: 'all' | 'filtered') => {
    const targetSet = scope === 'all' ? processedRecords : sortedRecords;
    if (targetSet.length === 0) return alert('No records available to export.');

    const doc = new jsPDF({ orientation: 'landscape' });
    const headers = ['Reg Date', ...fields.slice(0, 5).map((f) => f.label), 'Sync'];

    const data = targetSet.map((rec) => {
      const row = [
        new Date(rec.created_at).toLocaleDateString(),
        ...fields.slice(0, 5).map((f) => String(rec[f.id] || '')),
        rec.synced === 1 ? 'Synced' : 'Offline'
      ];
      return row;
    });

    // Elegant header banner
    doc.setFontSize(18);
    doc.setTextColor(2, 132, 199); // primary sky
    doc.text('Medical Outreach Record System (MORS)', 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Outreach Intake Patient Registry Export - Scope: ${scope.toUpperCase()}`, 14, 23);
    doc.text(`Date of Export: ${new Date().toLocaleString()}`, 14, 28);

    autoTable(doc, {
      head: [headers],
      body: data,
      startY: 32,
      theme: 'striped',
      headStyles: { fillColor: [2, 132, 199], textColor: [255, 255, 255] },
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: { 0: { cellWidth: 24 } }
    });

    doc.save(`MORS_Intake_Export_${scope}.pdf`);
  };

  // INDIVIDUAL PDF REPORT PRINTER
  const downloadSinglePatientPDF = (rec: ProcessedRecord) => {
    const doc = new jsPDF();

    // Border Frame
    doc.rect(5, 5, 200, 287);

    // Document Header
    doc.setFontSize(22);
    doc.setTextColor(2, 132, 199);
    doc.text('PATIENT OUTREACH CLINICAL RECORD', 14, 25);
    
    // Line separator
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 29, 196, 29);

    // Metadata block
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Submission Reference: ${rec.id}`, 14, 35);
    doc.text(`Date of Capture: ${new Date(rec.created_at).toLocaleString()}`, 14, 40);
    doc.text(`Record Sync status: ${rec.synced === 1 ? 'SYNCED TO SUPABASE SERVER' : 'STORED OFFLINE LOCAL'}`, 14, 45);

    doc.setDrawColor(2, 132, 199);
    doc.setLineWidth(0.5);
    doc.line(14, 48, 196, 48);

    // Content Block Title
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('PATIENT PROFILE AND CLINICAL EVALUATION', 14, 56);

    // Patient info rows
    let currentY = 64;
    fields.forEach((field) => {
      if (currentY > 260) {
        doc.addPage();
        doc.rect(5, 5, 200, 287);
        currentY = 20;
      }

      const val = rec[field.id] || '---';

      // Grey block background
      doc.setFillColor(248, 250, 252);
      doc.rect(14, currentY, 182, 12, 'F');

      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(field.label, 18, currentY + 7);

      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      
      // Handle longer lines in textarea
      if (field.type === 'textarea') {
        const textLines = doc.splitTextToSize(String(val), 110);
        doc.text(textLines, 74, currentY + 6);
      } else {
        doc.text(String(val), 74, currentY + 7);
      }

      currentY += 14;
    });

    // Signature Block at base
    if (currentY > 230) {
      doc.addPage();
      doc.rect(5, 5, 200, 287);
      currentY = 40;
    }

    doc.setDrawColor(226, 232, 240);
    doc.line(14, currentY + 10, 196, currentY + 10);

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('Volunteer Attendant Signature:', 14, currentY + 24);
    doc.line(70, currentY + 24, 130, currentY + 24);

    doc.text('Stamp:', 142, currentY + 24);
    doc.rect(155, currentY + 15, 30, 15);

    doc.save(`MORS_Patient_Record_${rec.id.slice(0, 8)}.pdf`);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header Banner */}
      <div className="flex justify-between items-start flex-wrap gap-4 border-b dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Patient Registrations Registry
            </h1>
            {pullingRemote && (
              <span className="inline-flex items-center gap-1.5 text-xs text-sky-500 bg-sky-50 dark:bg-sky-950/20 px-2 py-0.5 rounded-md animate-pulse">
                <DownloadCloud className="h-3 w-3 animate-bounce" /> Updating cache...
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Display, query, slice, and generate certified exports of patients captured during medical outreaches.
          </p>
        </div>

        {/* Global Export Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Export Dropdown options */}
          <div className="inline-flex rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-800 p-1 text-slate-700 dark:text-slate-200">
            <button
              onClick={() => exportToExcel('filtered')}
              className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-sky-600 rounded-lg flex items-center gap-1 text-xs font-bold transition-all cursor-pointer"
              title="Export filtered records to Excel"
            >
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </button>
            <button
              onClick={() => exportToPDF('filtered')}
              className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-red-500 rounded-lg flex items-center gap-1 text-xs font-bold transition-all cursor-pointer"
              title="Export filtered records to PDF"
            >
              <FileText className="h-4 w-4" /> PDF Table
            </button>
            <button
              onClick={() => exportToCSV('filtered')}
              className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 rounded-lg flex items-center gap-1 text-xs font-bold transition-all cursor-pointer"
              title="Export filtered records as CSV text"
            >
              <FileCode className="h-4 w-4" /> CSV
            </button>
          </div>
        </div>
      </div>

      {/* FILTER SEARCH TOOLBAR */}
      <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl shadow-xs p-6 flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          
          {/* Main Search input (Col 6) */}
          <div className="md:col-span-6 relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search by patient name, diagnosis, medication given, symptoms..."
              className="medical-input pl-9 py-2 px-3 text-sm"
            />
          </div>

          {/* Age range Selector (Col 3) */}
          <div className="md:col-span-3 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase shrink-0">Age:</span>
            <select
              value={selectedAgeRange}
              onChange={(e) => { setSelectedAgeRange(e.target.value); setCurrentPage(1); }}
              className="medical-input py-2 px-3 text-sm"
            >
              <option value="all">All Ages</option>
              <option value="child">Child (0-12)</option>
              <option value="teen">Teen (13-19)</option>
              <option value="adult">Adult (20-59)</option>
              <option value="senior">Senior (60+)</option>
            </select>
          </div>

          {/* Date Selector (Col 3) */}
          <div className="md:col-span-3 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase shrink-0"><Calendar className="h-3.5 w-3.5" /></span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); setCurrentPage(1); }}
              className="medical-input py-2 px-3 text-sm"
            />
          </div>

        </div>

        {/* Dynamic Filters Grid (Renders choice inputs like Gender/Diagnosis) */}
        {choiceBasedFields.length > 0 && (
          <div className="border-t dark:border-slate-800 pt-4 flex flex-wrap gap-4 items-center">
            <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> Quick Filters:
            </span>
            
            {choiceBasedFields.map((field) => (
              <div key={field.id} className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-500">{field.label}:</span>
                <select
                  value={customFilters[field.id] || ''}
                  onChange={(e) => handleCustomFilterChange(field.id, e.target.value)}
                  className="bg-slate-50 border dark:border-slate-800 dark:bg-slate-900 rounded-lg text-xs py-1.5 px-2.5 font-bold outline-none text-slate-700 dark:text-slate-200"
                >
                  <option value="">All</option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            ))}

            {(searchQuery || selectedAgeRange !== 'all' || selectedDate || Object.values(customFilters).some(Boolean)) && (
              <button
                onClick={clearAllFilters}
                className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors ml-auto cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* CORE DATA TABLE VIEW */}
      <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-2 text-slate-400">
            <svg className="animate-spin h-8 w-8 text-sky-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-xs">Loading patient registry databases...</span>
          </div>
        ) : sortedRecords.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <AlertCircle className="h-10 w-10 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
            <p className="font-bold text-base">No Records Located</p>
            <p className="text-xs mt-0.5">Try adjusting your filters, query text, or date ranges.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              
              {/* Header */}
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-800 text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('created_at')}>
                    <span className="flex items-center gap-1">Date <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                  {fields.slice(0, 4).map((field) => (
                    <th 
                      key={field.id} 
                      className="py-4 px-6 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                      onClick={() => handleSort(field.id)}
                    >
                      <span className="flex items-center gap-1">{field.label} <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                  ))}
                  <th className="py-4 px-6 text-center">Sync</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>

              {/* Rows */}
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {paginatedRecords.map((rec) => (
                  <tr 
                    key={rec.id}
                    className="hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition-colors"
                  >
                    {/* Timestamp */}
                    <td className="py-3.5 px-6 font-medium text-slate-500 whitespace-nowrap">
                      {new Date(rec.created_at).toLocaleDateString()} <span className="text-[10px] opacity-75">{new Date(rec.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>

                    {/* Dynamic cells mapping */}
                    {fields.slice(0, 4).map((field) => (
                      <td key={field.id} className="py-3.5 px-6 font-semibold text-slate-800 dark:text-slate-200 max-w-[180px] truncate">
                        {String(rec[field.id] || '---')}
                      </td>
                    ))}

                    {/* Sync Status Badge */}
                    <td className="py-3.5 px-6 text-center">
                      <span 
                        className={`inline-flex w-2 h-2 rounded-full ${
                          rec.synced === 1 ? 'bg-emerald-500' : 'bg-amber-500'
                        }`} 
                        title={rec.synced === 1 ? 'Synced' : 'Saved Locally (Offline)'} 
                      />
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedSubmission(rec._raw)}
                          className="p-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/20 dark:hover:bg-sky-950/40 text-sky-600 dark:text-sky-400 transition-colors cursor-pointer"
                          title="Open full report details drawer"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => downloadSinglePatientPDF(rec)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
                          title="Download individual PDF report"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>

            </table>
          </div>
        )}

        {/* Dynamic Pagination footer */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t dark:border-slate-800 flex justify-between items-center text-xs font-bold text-slate-400 bg-slate-50/50 dark:bg-slate-900/20">
            <span>Showing Page {currentPage} of {totalPages} ({sortedRecords.length} records)</span>
            
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 border dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 rounded-lg disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 border dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 rounded-lg disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PATIENT DETAILS OVERLAY SLIDE-OUT DRAWER */}
      <AnimatePresence>
        {selectedSubmission && (
          <>
            {/* Dark blur overlay backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSubmission(null)}
              className="fixed inset-0 bg-black z-50 backdrop-blur-xs"
            />

            {/* Sidebar drawer container */}
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-lg bg-white dark:bg-slate-900 border-l dark:border-slate-800 shadow-2xl flex flex-col"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/40">
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/20 px-2 py-0.5 rounded">Intake Profile</span>
                  <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">Patient Details Summary</h3>
                </div>
                
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 rounded-xl"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
                
                {/* Meta details Block */}
                <div className="bg-slate-50 dark:bg-slate-950 border dark:border-slate-800/80 rounded-2xl p-4 font-mono text-[11px] text-slate-500 flex flex-col gap-2">
                  <div className="flex justify-between border-b dark:border-slate-800 pb-1.5">
                    <span>Reference ID:</span>
                    <span className="text-slate-800 dark:text-slate-300 font-bold truncate max-w-[200px]" title={selectedSubmission.id}>
                      {selectedSubmission.id}
                    </span>
                  </div>
                  <div className="flex justify-between border-b dark:border-slate-800 pb-1.5">
                    <span>Captured At:</span>
                    <span className="text-slate-800 dark:text-slate-300 font-bold">
                      {new Date(selectedSubmission.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Network Sync:</span>
                    <span className={`font-bold ${selectedSubmission.synced === 1 ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {selectedSubmission.synced === 1 ? 'Synced Server DB' : 'Saved Locally (Offline)'}
                    </span>
                  </div>
                </div>

                {/* Patient values list mapping */}
                <div className="flex flex-col gap-4">
                  {fields.map((field) => {
                    const ans = selectedSubmission.values[field.id] || '---';
                    return (
                      <div key={field.id} className="flex flex-col gap-1.5 border-b dark:border-slate-800/60 pb-3">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                          {field.label}
                        </span>
                        
                        {field.type === 'textarea' ? (
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                            {ans}
                          </p>
                        ) : (
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            {ans}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

              </div>

              {/* Drawer Actions Footer */}
              <div className="p-5 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 flex gap-3">
                <button
                  onClick={() => {
                    // Map helper
                    const recordMock: ProcessedRecord = {
                      id: selectedSubmission.id,
                      created_at: selectedSubmission.created_at,
                      synced: selectedSubmission.synced,
                      _raw: selectedSubmission,
                      _age: null,
                    };
                    fields.forEach((f) => {
                      recordMock[f.id] = selectedSubmission.values[f.id] || '';
                    });
                    downloadSinglePatientPDF(recordMock);
                  }}
                  className="medical-btn-primary flex-1 text-xs py-3 px-4 font-bold flex items-center justify-center gap-1.5"
                >
                  <Printer className="h-4 w-4" /> Download Certified Report
                </button>
                <button
                  onClick={() => handleDeleteRecord(selectedSubmission.id)}
                  className="bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 py-3 px-4 font-bold flex items-center justify-center rounded-xl transition-colors"
                  title="Delete Record"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
