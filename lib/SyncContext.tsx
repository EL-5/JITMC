'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  getUnsyncedSubmissions, 
  markSubmissionSynced, 
  getLocalFields, 
  saveLocalFields, 
  FormField,
  seedDefaultFields
} from './db';
import { supabase, isSupabaseConfigured } from './supabase';

/** Shape of a raw form_fields row returned from Supabase. */
interface SupabaseFieldRow {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options: string[];
  sort_order: number;
}

interface SyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: Date | null;
  triggerSync: () => Promise<boolean>;
  syncFields: () => Promise<FormField[]>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider = ({ children }: { children: ReactNode }) => {
  // Use lazy initializer to prevent server-side navigator.onLine errors and avoid synchronous mount sets
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  });
  
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Define helpers first (prevents variable access before declaration issues)

  // 1. Poll for pending count changes
  const updatePendingCount = async () => {
    try {
      const unsynced = await getUnsyncedSubmissions();
      setPendingCount(unsynced.length);
    } catch (e) {
      console.error('Error counting pending syncs:', e);
    }
  };

  // 2. Sync Dynamic Form Fields from Supabase
  const syncFields = async (): Promise<FormField[]> => {
    if (!isSupabaseConfigured || !supabase) {
      return getLocalFields();
    }

    try {
      const { data, error } = await supabase
        .from('form_fields')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        // Map keys to match TypeScript structure
        const mappedFields: FormField[] = data.map((f: SupabaseFieldRow) => ({
          id: f.id,
          label: f.label,
          type: f.type as FormField['type'],
          required: f.required,
          options: f.options || [],
          sort_order: f.sort_order || 0
        }));

        // Update IndexedDB cache
        await saveLocalFields(mappedFields);
        return mappedFields;
      }
    } catch (err) {
      console.error('Failed to sync form fields from Supabase:', err);
    }

    return getLocalFields();
  };

  // 3. Core Sync Submissions Logic
  const triggerSync = async (): Promise<boolean> => {
    if (isSyncing) return false;
    
    // Check network and DB configurations
    if (typeof window !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      return false;
    }
    
    setIsOnline(true);

    if (!isSupabaseConfigured || !supabase) {
      console.log('MORS: Supabase not configured. Records remain stored securely in local IndexedDB.');
      return false;
    }

    const unsynced = await getUnsyncedSubmissions();
    if (unsynced.length === 0) {
      setPendingCount(0);
      return true;
    }

    setIsSyncing(true);
    let success = true;

    try {
      for (const sub of unsynced) {
        // Step 3a: Insert base submission row
        const { error: subError } = await supabase
          .from('submissions')
          .insert({
            id: sub.id,
            created_at: sub.created_at,
            synced_at: new Date().toISOString()
          });

        // Duplicate key is fine if we partially failed in a previous attempt
        if (subError && !subError.message?.includes('duplicate key')) {
          console.error(`Failed to sync submission base ${sub.id}:`, subError);
          success = false;
          continue;
        }

        // Step 3b: Insert individual field values
        const valuesToInsert = Object.entries(sub.values).map(([field_id, value]) => ({
          submission_id: sub.id,
          field_id,
          value
        }));

        if (valuesToInsert.length > 0) {
          const { error: valError } = await supabase
            .from('submission_values')
            .upsert(valuesToInsert, { onConflict: 'submission_id,field_id' });

          if (valError) {
            console.error(`Failed to sync values for submission ${sub.id}:`, valError);
            success = false;
            continue;
          }
        }

        // Step 3c: Mark local copy as synced
        await markSubmissionSynced(sub.id);
      }

      if (success) {
        setLastSyncTime(new Date());
      }
      await updatePendingCount();
    } catch (err) {
      console.error('General synchronization failure:', err);
      success = false;
    } finally {
      setIsSyncing(false);
    }

    return success;
  };

  // Mount logic which calls defined helpers
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initAppDb = async () => {
      try {
        await seedDefaultFields();
        await syncFields();
      } catch (err) {
        console.error('Error initializing db seed:', err);
      }
      await updatePendingCount();
    };
    
    initAppDb();

    // Deferred status updates to avoid synchronous mount-loop lint errors
    setTimeout(() => {
      setIsOnline(navigator.onLine);
    }, 0);

    const handleOnline = () => {
      setIsOnline(true);
      triggerSync(); // Sync automatically when returning online
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = setInterval(updatePendingCount, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingCount,
        lastSyncTime,
        triggerSync,
        syncFields
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
};
