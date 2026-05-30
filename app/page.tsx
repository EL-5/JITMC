'use client';

import React, { useEffect, useState } from 'react';
import { getLocalFields, saveLocalSubmission, getLocalSubmissions, saveLocalSubmissions, FormField, PatientSubmission } from '@/lib/db';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSync } from '@/lib/SyncContext';
import { 
  ClipboardCopy, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  UserPlus, 
  Save,
  RotateCcw,
  Users,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PatientRegistration() {
  const { isOnline, triggerSync, syncFields } = useSync();
  const [fields, setFields] = useState<FormField[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  
  // Recent registrations feed
  const [recentSubmissions, setRecentSubmissions] = useState<PatientSubmission[]>([]);

  // Submission outcome states
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [lastSubId, setLastSubId] = useState<string>('');

  // Load form fields and recent submissions on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Always pull latest form fields from Supabase so changes made in the
        // form builder by any user are immediately reflected here.
        const latestFields = await syncFields();
        setFields(latestFields);

        const savedDraft = localStorage.getItem('mors-patient-draft');
        if (savedDraft) {
          try {
            setFormValues(JSON.parse(savedDraft));
          } catch (e) {
            console.error('Failed to restore draft values', e);
          }
        }

        // Load local submissions first for instant display
        const localSubs = await getLocalSubmissions();
        const localSorted = localSubs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setRecentSubmissions(localSorted.slice(0, 8));

        // If online, pull all submissions from Supabase so records from other
        // users/devices are visible in the live feed.
        if (isOnline && isSupabaseConfigured && supabase) {
          try {
            const { data: subData, error: subError } = await supabase
              .from('submissions')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(50);

            if (!subError && subData && subData.length > 0) {
              const { data: valData } = await supabase
                .from('submission_values')
                .select('*');

              const remoteSubmissions: PatientSubmission[] = subData.map((s: Record<string, string>) => {
                const valuesMap: Record<string, string> = {};
                (valData || [])
                  .filter((v: Record<string, string>) => v.submission_id === s.id)
                  .forEach((v: Record<string, string>) => {
                    valuesMap[v.field_id] = v.value;
                  });
                return { id: s.id, created_at: s.created_at, values: valuesMap, synced: 1 };
              });

              // Merge remote into local cache
              await saveLocalSubmissions(remoteSubmissions);
              const freshSubs = await getLocalSubmissions();
              const sorted = freshSubs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              setRecentSubmissions(sorted.slice(0, 8));
            }
          } catch (remoteErr) {
            console.warn('Could not pull remote submissions for feed:', remoteErr);
          }
        }
      } catch (err) {
        console.error('Failed to load page config:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();

    // Poll Supabase every 10s to keep the live feed up-to-date across users
    const interval = setInterval(async () => {
      try {
        if (isOnline && isSupabaseConfigured && supabase) {
          const { data: subData, error } = await supabase
            .from('submissions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

          if (!error && subData && subData.length > 0) {
            const { data: valData } = await supabase.from('submission_values').select('*');
            const remoteSubmissions: PatientSubmission[] = subData.map((s: Record<string, string>) => {
              const valuesMap: Record<string, string> = {};
              (valData || [])
                .filter((v: Record<string, string>) => v.submission_id === s.id)
                .forEach((v: Record<string, string>) => { valuesMap[v.field_id] = v.value; });
              return { id: s.id, created_at: s.created_at, values: valuesMap, synced: 1 };
            });
            await saveLocalSubmissions(remoteSubmissions);
          }
        }
        const subs = await getLocalSubmissions();
        const sorted = subs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setRecentSubmissions(sorted.slice(0, 8));
      } catch (_) {}
    }, 10000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  const handleInputChange = (fieldId: string, value: string) => {
    const newValues = { ...formValues, [fieldId]: value };
    setFormValues(newValues);
    localStorage.setItem('mors-patient-draft', JSON.stringify(newValues));
    if (errors[fieldId]) {
      const newErrors = { ...errors };
      delete newErrors[fieldId];
      setErrors(newErrors);
    }
  };

  const handleCheckboxChange = (fieldId: string, option: string, checked: boolean) => {
    const currentVal = formValues[fieldId] || '';
    let selectedOptions = currentVal ? currentVal.split(', ') : [];
    if (checked) {
      if (!selectedOptions.includes(option)) selectedOptions.push(option);
    } else {
      selectedOptions = selectedOptions.filter((opt) => opt !== option);
    }
    handleInputChange(fieldId, selectedOptions.join(', '));
  };

  const handleResetForm = () => {
    if (window.confirm('Clear this draft? All current text will be deleted.')) {
      setFormValues({});
      setErrors({});
      localStorage.removeItem('mors-patient-draft');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const newErrors: Record<string, string> = {};
    fields.forEach((field) => {
      const val = (formValues[field.id] || '').trim();
      if (field.required && !val) newErrors[field.id] = `${field.label} is required`;
    });
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstErrField = Object.keys(newErrors)[0];
      document.getElementById(`field-container-${firstErrField}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    try {
      const submissionId = crypto.randomUUID();
      const timestamp = new Date().toISOString();
      const newSubmission = { id: submissionId, created_at: timestamp, values: formValues, synced: 0 };
      await saveLocalSubmission(newSubmission);
      localStorage.removeItem('mors-patient-draft');
      setFormValues({});
      setErrors({});
      setSubmitted(true);
      setLastSubId(submissionId);
      if (isOnline) {
        triggerSync().catch((e) => console.error('Silent background sync fail:', e));
      }
      // Refresh recent feed
      const subs = await getLocalSubmissions();
      const sorted = subs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRecentSubmissions(sorted.slice(0, 8));
    } catch (err) {
      console.error('Failed to submit patient data:', err);
      alert('Error saving record. Please review console logs.');
    }
  };

  const handleRegisterAnother = () => {
    setSubmitted(false);
    setLastSubId('');
  };

  if (!loading && fields.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6" style={{ background: 'var(--background)' }}>
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-[#d1dce8] dark:border-slate-800 p-8 text-center rounded-2xl shadow-sm">
          <div className="mx-auto w-12 h-12 bg-[#e8f0fa] dark:bg-slate-950 text-[#1a3a5c] dark:text-slate-400 rounded-full flex items-center justify-center mb-4">
            <ClipboardCopy className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold mb-2 text-[#0d1f2d] dark:text-white">No Registration Fields Loaded</h2>
          <p className="text-sm text-[#4a6580] dark:text-slate-400 mb-6">
            No fields configured yet. Open the Form Builder to add intake fields, then return here to register patients.
          </p>
          <a
            href="/admin/form-builder"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-white rounded-xl text-sm font-semibold transition-colors"
            style={{ background: 'var(--primary)' }}
          >
            Open Form Builder
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 py-6 px-4 sm:px-6 lg:px-8 w-full">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">

          {/* LEFT: Registration Form (Col 8) */}
          <div className="xl:col-span-8">
            <AnimatePresence mode="wait">
              {submitted ? (
                /* SUCCESS SCREEN */
                <motion.div
                  key="success-screen"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25 }}
                  className="bg-white dark:bg-slate-900 border border-[#d1dce8] dark:border-slate-800 rounded-2xl shadow-sm p-8 text-center"
                >
                  <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle className="h-10 w-10" />
                  </div>
                  <h2 className="text-2xl font-bold text-[#0d1f2d] dark:text-white mb-2">Patient Registered!</h2>
                  <p className="text-sm text-[#4a6580] dark:text-slate-400 max-w-md mx-auto mb-6">
                    The record has been saved to local storage.
                    {isOnline 
                      ? ' A background sync has been triggered to push this to the cloud.' 
                      : ' It will be uploaded automatically once internet is restored.'
                    }
                  </p>
                  <div className="bg-[#f0f4f8] dark:bg-slate-950 rounded-xl p-4 text-left font-mono text-xs text-[#4a6580] dark:text-slate-400 max-w-sm mx-auto mb-8 border border-[#d1dce8] dark:border-slate-900">
                    <div className="flex justify-between border-b border-[#d1dce8] dark:border-slate-800 pb-2 mb-2">
                      <span>Record ID:</span>
                      <span className="text-[#0d1f2d] dark:text-slate-200 font-bold truncate max-w-[200px]" title={lastSubId}>{lastSubId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className={`font-bold ${isOnline ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {isOnline ? 'Queued for Sync' : 'Saved Offline (Pending)'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={handleRegisterAnother}
                      className="inline-flex items-center justify-center gap-1.5 px-6 py-3 text-white rounded-xl text-sm font-semibold active:scale-95 transition-all cursor-pointer"
                      style={{ background: 'var(--primary)' }}
                    >
                      <UserPlus className="h-4 w-4" /> Register Next Patient
                    </button>
                    <a
                      href="/admin/dashboard"
                      className="inline-flex items-center justify-center gap-1.5 px-6 py-3 bg-[#e8f0fa] hover:bg-[#d1dce8] dark:bg-slate-800 dark:hover:bg-slate-700 text-[#1a3a5c] dark:text-slate-200 rounded-xl text-sm font-semibold transition-all"
                    >
                      View Records Dashboard
                    </a>
                  </div>
                </motion.div>
              ) : (
                /* REGISTRATION FORM */
                <motion.div
                  key="form-screen"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col gap-6"
                >
                  {/* Page Header */}
                  <div className="flex flex-col gap-1">
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0d1f2d] dark:text-white">
                      Register New Patient
                    </h1>
                    <p className="text-sm text-[#4a6580] dark:text-slate-400">
                      Complete the patient intake profile. Data is auto-saved as drafts.
                    </p>
                  </div>

                  {loading ? (
                    <div className="bg-white dark:bg-slate-900 border border-[#d1dce8] dark:border-slate-800 rounded-2xl p-8 flex flex-col gap-6 items-center justify-center h-64">
                      <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--primary)' }} />
                      <span className="text-xs text-[#4a6580]">Loading form fields...</span>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-[#d1dce8] dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                      <div className="p-6 sm:p-8 flex flex-col gap-6 divide-y divide-[#e4ecf4] dark:divide-slate-800/50">
                        {fields.map((field, idx) => {
                          const error = errors[field.id];
                          const value = formValues[field.id] || '';
                          return (
                            <div
                              key={field.id}
                              id={`field-container-${field.id}`}
                              className={`flex flex-col gap-2 ${idx > 0 ? 'pt-6' : ''}`}
                            >
                              <label className="flex items-center gap-1.5 text-sm font-bold text-[#0d1f2d] dark:text-slate-300">
                                {field.label}
                                {field.required && <span className="text-red-500" title="Required">*</span>}
                              </label>

                              {field.type === 'text' && (
                                <input type="text" value={value} onChange={(e) => handleInputChange(field.id, e.target.value)}
                                  placeholder={`Enter ${field.label.toLowerCase()}`}
                                  className={`medical-input ${error ? 'border-red-500 focus:border-red-500' : ''}`} />
                              )}
                              {field.type === 'number' && (
                                <input type="number" value={value} onChange={(e) => handleInputChange(field.id, e.target.value)}
                                  placeholder="e.g. 24" min="0" max="150"
                                  className={`medical-input ${error ? 'border-red-500' : ''}`} />
                              )}
                              {field.type === 'select' && (
                                <select value={value} onChange={(e) => handleInputChange(field.id, e.target.value)}
                                  className={`medical-input ${error ? 'border-red-500' : ''}`}>
                                  <option value="">-- Choose Option --</option>
                                  {field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                              )}
                              {field.type === 'textarea' && (
                                <textarea value={value} onChange={(e) => handleInputChange(field.id, e.target.value)}
                                  rows={3} placeholder={`Add notes for ${field.label.toLowerCase()}`}
                                  className={`medical-input resize-y ${error ? 'border-red-500' : ''}`} />
                              )}
                              {field.type === 'date' && (
                                <input type="date" value={value} onChange={(e) => handleInputChange(field.id, e.target.value)}
                                  className={`medical-input ${error ? 'border-red-500' : ''}`} />
                              )}
                              {field.type === 'radio' && (
                                <div className="flex flex-wrap gap-4 py-1.5">
                                  {field.options.map((opt) => (
                                    <label key={opt} className="inline-flex items-center gap-2 cursor-pointer text-sm font-semibold select-none text-[#0d1f2d] dark:text-slate-300">
                                      <input type="radio" name={`radio-group-${field.id}`} value={opt}
                                        checked={value === opt} onChange={() => handleInputChange(field.id, opt)}
                                        className="h-4 w-4" />
                                      {opt}
                                    </label>
                                  ))}
                                </div>
                              )}
                              {field.type === 'checkbox' && (
                                <div className="flex flex-col gap-2 py-1.5">
                                  {field.options.map((opt) => {
                                    const checked = (value ? value.split(', ') : []).includes(opt);
                                    return (
                                      <label key={opt} className="inline-flex items-center gap-2.5 cursor-pointer text-sm font-semibold select-none text-[#0d1f2d] dark:text-slate-300">
                                        <input type="checkbox" checked={checked}
                                          onChange={(e) => handleCheckboxChange(field.id, opt, e.target.checked)}
                                          className="h-4 w-4 rounded" />
                                        {opt}
                                      </label>
                                    );
                                  })}
                                </div>
                              )}

                              {error && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-500">
                                  <AlertCircle className="h-3.5 w-3.5" /> {error}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Form Footer Actions */}
                      <div className="px-6 py-4 bg-[#f0f4f8] dark:bg-slate-900/40 border-t border-[#d1dce8] dark:border-slate-800 flex justify-between gap-3 flex-wrap">
                        <button type="button" onClick={handleResetForm}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-[#4a6580] hover:text-[#0d1f2d] dark:text-slate-400 dark:hover:text-slate-200 text-sm font-bold transition-colors cursor-pointer">
                          <RotateCcw className="h-4 w-4" /> Clear Draft
                        </button>
                        <button type="submit" className="medical-btn-primary gap-2">
                          <Save className="h-4 w-4" /> Save Patient Record
                        </button>
                      </div>
                    </form>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* RIGHT: Live Registration Feed (Col 4) */}
          <div className="xl:col-span-4 flex flex-col gap-4">
            <div className="bg-white dark:bg-slate-900 border border-[#d1dce8] dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              {/* Feed Header */}
              <div className="px-5 py-4 border-b border-[#d1dce8] dark:border-slate-800 flex items-center justify-between bg-[#1a3a5c] dark:bg-slate-900/80">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-white/20 rounded-lg">
                    <Users className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-white leading-none">Live Registrations</h2>
                    <span className="text-[10px] text-blue-200 font-medium">Auto-refreshing every 5s</span>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-900/30 border border-emerald-700/40 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  LIVE
                </span>
              </div>

              {/* Count badge */}
              <div className="px-5 py-3 bg-[#e8f0fa] dark:bg-slate-800/40 border-b border-[#d1dce8] dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-[#4a6580] dark:text-slate-400">Total today &amp; all time</span>
                <span className="text-lg font-black text-[#1a3a5c] dark:text-white">{recentSubmissions.length}</span>
              </div>

              {/* Feed Items */}
              <div className="flex flex-col divide-y divide-[#e4ecf4] dark:divide-slate-800 max-h-[480px] overflow-y-auto">
                {recentSubmissions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-[#4a6580] dark:text-slate-500">
                    <Users className="h-8 w-8 opacity-30" />
                    <p className="text-xs font-semibold">No patients registered yet</p>
                    <p className="text-[10px] opacity-70">Records will appear here instantly</p>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {recentSubmissions.map((sub, idx) => {
                      const primaryLabel = fields[0]?.label || 'Patient';
                      const primaryVal = fields[0] ? (sub.values[fields[0].id] || 'Unknown') : 'Unknown';
                      const secondaryLabel = fields[1]?.label || '';
                      const secondaryVal = fields[1] ? (sub.values[fields[1].id] || '---') : '';
                      const timeStr = new Date(sub.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const dateStr = new Date(sub.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' });

                      return (
                        <motion.div
                          key={sub.id}
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: idx * 0.03 }}
                          className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#f0f4f8] dark:hover:bg-slate-800/30 transition-colors"
                        >
                          {/* Avatar */}
                          <div className="w-9 h-9 rounded-full bg-[#1a3a5c] dark:bg-slate-700 flex items-center justify-center text-white font-black text-sm shrink-0">
                            {String(primaryVal).charAt(0).toUpperCase()}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-[#0d1f2d] dark:text-white truncate">{primaryVal}</p>
                            {secondaryVal && (
                              <p className="text-[11px] text-[#4a6580] dark:text-slate-400 truncate">
                                {secondaryLabel}: {secondaryVal}
                              </p>
                            )}
                          </div>

                          {/* Time */}
                          <div className="text-right shrink-0">
                            <p className="text-[10px] font-bold text-[#4a6580] dark:text-slate-400">{timeStr}</p>
                            <p className="text-[9px] text-[#4a6580] dark:text-slate-600">{dateStr}</p>
                            <span className={`inline-block w-1.5 h-1.5 rounded-full mt-0.5 ${sub.synced === 1 ? 'bg-emerald-500' : 'bg-amber-500'}`} title={sub.synced === 1 ? 'Synced' : 'Pending'} />
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
              </div>

              {/* Footer link */}
              {recentSubmissions.length > 0 && (
                <div className="px-5 py-3 border-t border-[#d1dce8] dark:border-slate-800 bg-[#f0f4f8] dark:bg-slate-900/40">
                  <a href="/admin/dashboard"
                    className="text-xs font-bold text-[#1a3a5c] dark:text-sky-400 hover:underline flex items-center gap-1">
                    <Clock className="h-3 w-3" /> View full patient registry →
                  </a>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
