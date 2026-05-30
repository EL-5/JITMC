'use client';

import React, { useEffect, useState } from 'react';
import { getLocalFields, saveLocalSubmission, FormField } from '@/lib/db';
import { useSync } from '@/lib/SyncContext';
import { 
  ClipboardCopy, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  UserPlus, 
  Save,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PatientRegistration() {
  const { isOnline, triggerSync } = useSync();
  const [fields, setFields] = useState<FormField[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  
  // Submission outcome states
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [lastSubId, setLastSubId] = useState<string>('');

  // 1. Load form fields and drafts from local storage on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Load custom fields
        const localFields = await getLocalFields();
        setFields(localFields);

        // Load any pending form drafts
        const savedDraft = localStorage.getItem('mors-patient-draft');
        if (savedDraft) {
          try {
            setFormValues(JSON.parse(savedDraft));
          } catch (e) {
            console.error('Failed to restore draft values', e);
          }
        }
      } catch (err) {
        console.error('Failed to load page config:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // 2. Autosave draft on form value changes
  const handleInputChange = (fieldId: string, value: string) => {
    const newValues = { ...formValues, [fieldId]: value };
    setFormValues(newValues);
    localStorage.setItem('mors-patient-draft', JSON.stringify(newValues));

    // Clear inline error if user writes anything
    if (errors[fieldId]) {
      const newErrors = { ...errors };
      delete newErrors[fieldId];
      setErrors(newErrors);
    }
  };

  // Checkbox lists require special list handlers
  const handleCheckboxChange = (fieldId: string, option: string, checked: boolean) => {
    const currentVal = formValues[fieldId] || '';
    let selectedOptions = currentVal ? currentVal.split(', ') : [];

    if (checked) {
      if (!selectedOptions.includes(option)) {
        selectedOptions.push(option);
      }
    } else {
      selectedOptions = selectedOptions.filter((opt) => opt !== option);
    }

    const valueString = selectedOptions.join(', ');
    handleInputChange(fieldId, valueString);
  };

  // 3. Clear/Reset Draft Form
  const handleResetForm = () => {
    if (window.confirm('Are you sure you want to clear this entire draft? All current text will be deleted.')) {
      setFormValues({});
      setErrors({});
      localStorage.removeItem('mors-patient-draft');
    }
  };

  // 4. Form Submission Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate fields
    const newErrors: Record<string, string> = {};
    fields.forEach((field) => {
      const val = (formValues[field.id] || '').trim();
      if (field.required && !val) {
        newErrors[field.id] = `${field.label} is required`;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Scroll to the first error item
      const firstErrField = Object.keys(newErrors)[0];
      const element = document.getElementById(`field-container-${firstErrField}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Capture success
    try {
      const submissionId = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      const newSubmission = {
        id: submissionId,
        created_at: timestamp,
        values: formValues,
        synced: 0, // Mark unsynced for local queue
      };

      // Write to IndexedDB outbox
      await saveLocalSubmission(newSubmission);

      // Clear draft locally
      localStorage.removeItem('mors-patient-draft');
      setFormValues({});
      setErrors({});
      
      setSubmitted(true);
      setLastSubId(submissionId);

      // Proactively trigger backgrounds sync if internet exists
      if (isOnline) {
        triggerSync().catch((e) => console.error('Silent background sync fail:', e));
      }
    } catch (err) {
      console.error('Failed to submit patient data:', err);
      alert('Error saving record. Please review console logs.');
    }
  };

  const handleRegisterAnother = () => {
    setSubmitted(false);
    setLastSubId('');
  };

  // Empty layout state
  if (!loading && fields.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border dark:border-slate-800 p-8 text-center rounded-2xl shadow-sm">
          <div className="mx-auto w-12 h-12 bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 rounded-full flex items-center justify-center mb-4">
            <ClipboardCopy className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold mb-2">No Registration Fields Loaded</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            No fields have been configured yet. Open the Form Builder to add your intake fields and come back here to start registering patients.
          </p>
          <a
            href="/admin/form-builder"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-sky-500 text-white rounded-xl text-sm font-semibold hover:bg-sky-600 transition-colors"
          >
            Open Form Builder
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto w-full">
      <AnimatePresence mode="wait">
        {submitted ? (
          /* SUCCESS SUBMISSION SCREEN */
          <motion.div
            key="success-screen"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl shadow-sm p-8 text-center"
          >
            <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-6">
              <CheckCircle className="h-10 w-10" />
            </div>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Patient Registered Successfully!
            </h2>
            
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
              The record has been saved securely to local IndexedDB storage.
              {isOnline 
                ? ' A background sync has been triggered to push this record to Supabase.' 
                : ' It will be uploaded automatically once internet connectivity is restored.'
              }
            </p>

            {/* Micro-Details */}
            <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 text-left font-mono text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-8 border border-slate-100 dark:border-slate-900">
              <div className="flex justify-between border-b dark:border-slate-800 pb-2 mb-2">
                <span>Record ID:</span>
                <span className="text-slate-900 dark:text-slate-200 font-bold truncate max-w-[200px]" title={lastSubId}>
                  {lastSubId}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className={`font-bold ${isOnline ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {isOnline ? 'Queued for Sync' : 'Saved Offline (Pending)'}
                </span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleRegisterAnother}
                className="inline-flex items-center justify-center gap-1.5 px-6 py-3 bg-sky-500 text-white rounded-xl text-sm font-semibold hover:bg-sky-600 active:scale-95 transition-all cursor-pointer"
              >
                <UserPlus className="h-4 w-4" /> Register Next Patient
              </button>
              
              <a
                href="/admin/dashboard"
                className="inline-flex items-center justify-center gap-1.5 px-6 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold transition-all"
              >
                View Records Dashboard
              </a>
            </div>
          </motion.div>
        ) : (
          /* REGISTRATION FORM VIEW */
          <motion.div
            key="form-screen"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-6"
          >
            {/* Header Banner */}
            <div className="flex flex-col gap-1.5 text-center sm:text-left">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <Sparkles className="h-5 w-5 text-sky-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 py-1 px-2.5 rounded-full">
                  Volunteer Portal
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Register New Patient
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Please complete the patient intake profile. Data is saved automatically as drafts.
              </p>
            </div>

            {loading ? (
              /* Skeleton Loader */
              <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl p-8 flex flex-col gap-6 items-center justify-center h-64">
                <Loader2 className="h-8 w-8 text-sky-500 animate-spin" />
                <span className="text-xs text-slate-400">Loading form builder inputs...</span>
              </div>
            ) : (
              /* Core Form */
              <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
                
                {/* Form Fields Mapping */}
                <div className="p-6 sm:p-8 flex flex-col gap-6 divide-y divide-slate-100 dark:divide-slate-800/50">
                  {fields.map((field, idx) => {
                    const error = errors[field.id];
                    const value = formValues[field.id] || '';

                    return (
                      <div 
                        key={field.id} 
                        id={`field-container-${field.id}`}
                        className={`flex flex-col gap-2 ${idx > 0 ? 'pt-6' : ''}`}
                      >
                        {/* Label */}
                        <label className="flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-300">
                          {field.label}
                          {field.required && (
                            <span className="text-red-500" title="Required field">*</span>
                          )}
                        </label>

                        {/* Text / Normal Inputs */}
                        {field.type === 'text' && (
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => handleInputChange(field.id, e.target.value)}
                            placeholder={`Enter ${field.label.toLowerCase()}`}
                            className={`medical-input ${error ? 'border-red-500 focus:border-red-500 focus:box-shadow-red-glow' : ''}`}
                          />
                        )}

                        {/* Number Inputs */}
                        {field.type === 'number' && (
                          <input
                            type="number"
                            value={value}
                            onChange={(e) => handleInputChange(field.id, e.target.value)}
                            placeholder="e.g. 24"
                            min="0"
                            max="150"
                            className={`medical-input ${error ? 'border-red-500 focus:border-red-500' : ''}`}
                          />
                        )}

                        {/* Dropdown Selects */}
                        {field.type === 'select' && (
                          <select
                            value={value}
                            onChange={(e) => handleInputChange(field.id, e.target.value)}
                            className={`medical-input ${error ? 'border-red-500 focus:border-red-500' : ''}`}
                          >
                            <option value="">-- Choose Option --</option>
                            {field.options.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        )}

                        {/* Textareas */}
                        {field.type === 'textarea' && (
                          <textarea
                            value={value}
                            onChange={(e) => handleInputChange(field.id, e.target.value)}
                            rows={3}
                            placeholder={`Add notes for ${field.label.toLowerCase()}`}
                            className={`medical-input resize-y ${error ? 'border-red-500 focus:border-red-500' : ''}`}
                          />
                        )}

                        {/* Date Fields */}
                        {field.type === 'date' && (
                          <input
                            type="date"
                            value={value}
                            onChange={(e) => handleInputChange(field.id, e.target.value)}
                            className={`medical-input ${error ? 'border-red-500 focus:border-red-500' : ''}`}
                          />
                        )}

                        {/* Radio Options */}
                        {field.type === 'radio' && (
                          <div className="flex flex-wrap gap-4 py-1.5">
                            {field.options.map((opt) => (
                              <label key={opt} className="inline-flex items-center gap-2 cursor-pointer text-sm font-semibold select-none text-slate-600 dark:text-slate-300">
                                <input
                                  type="radio"
                                  name={`radio-group-${field.id}`}
                                  value={opt}
                                  checked={value === opt}
                                  onChange={() => handleInputChange(field.id, opt)}
                                  className="h-4 w-4 text-sky-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-sky-500"
                                />
                                {opt}
                              </label>
                            ))}
                          </div>
                        )}

                        {/* Checkbox Options */}
                        {field.type === 'checkbox' && (
                          <div className="flex flex-col gap-2 py-1.5">
                            {field.options.map((opt) => {
                              const checked = (value ? value.split(', ') : []).includes(opt);
                              return (
                                <label key={opt} className="inline-flex items-center gap-2.5 cursor-pointer text-sm font-semibold select-none text-slate-600 dark:text-slate-300">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => handleCheckboxChange(field.id, opt, e.target.checked)}
                                    className="h-4 w-4 rounded text-sky-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-sky-500"
                                  />
                                  {opt}
                                </label>
                              );
                            })}
                          </div>
                        )}

                        {/* Inline Field Error Messages */}
                        {error && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-red-500">
                            <AlertCircle className="h-3.5 w-3.5" /> {error}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Form Action Buttons Footer */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/40 border-t dark:border-slate-800 flex justify-between gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 text-sm font-bold transition-colors cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4" /> Clear Draft
                  </button>

                  <button
                    type="submit"
                    className="medical-btn-primary gap-2"
                  >
                    <Save className="h-4 w-4" /> Save Patient Record
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
