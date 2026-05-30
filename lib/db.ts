import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'radio' | 'checkbox' | 'date' | 'textarea';
  required: boolean;
  options: string[];
  sort_order: number;
}

export interface PatientSubmission {
  id: string;
  created_at: string;
  values: Record<string, string>; // maps field_id -> input value
  synced: number; // 0 = unsynced, 1 = synced
}

interface MORSDatabaseSchema extends DBSchema {
  form_fields: {
    key: string;
    value: FormField;
    indexes: { 'by-order': number };
  };
  submissions: {
    key: string;
    value: PatientSubmission;
    indexes: {
      'by-sync-status': number;
      'by-date': string;
    };
  };
}

const DATABASE_NAME = 'mors_local_db';
const DATABASE_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<MORSDatabaseSchema>> | null = null;

export const initDB = (): Promise<IDBPDatabase<MORSDatabaseSchema>> => {
  if (typeof window === 'undefined') {
    // Return a dummy promise during SSR
    return new Promise(() => {});
  }
  
  if (!dbPromise) {
    dbPromise = openDB<MORSDatabaseSchema>(DATABASE_NAME, DATABASE_VERSION, {
      upgrade(db) {
        // Form Fields Store
        const fieldStore = db.createObjectStore('form_fields', {
          keyPath: 'id',
        });
        fieldStore.createIndex('by-order', 'sort_order');

        // Submissions Store
        const submissionStore = db.createObjectStore('submissions', {
          keyPath: 'id',
        });
        submissionStore.createIndex('by-sync-status', 'synced');
        submissionStore.createIndex('by-date', 'created_at');
      },
    });
  }
  return dbPromise;
};

// Seed default fields if the store is empty
export const seedDefaultFields = async () => {
  const fields = await getLocalFields();
  if (fields.length === 0) {
    const defaultFields: FormField[] = [
      {
        id: 'a0000000-0000-0000-0000-000000000001',
        label: 'Full Name',
        type: 'text',
        required: true,
        options: [],
        sort_order: 1,
      },
      {
        id: 'a0000000-0000-0000-0000-000000000002',
        label: 'Age',
        type: 'number',
        required: true,
        options: [],
        sort_order: 2,
      },
      {
        id: 'a0000000-0000-0000-0000-000000000003',
        label: 'Gender',
        type: 'select',
        required: true,
        options: ['Male', 'Female', 'Other'],
        sort_order: 3,
      },
      {
        id: 'a0000000-0000-0000-0000-000000000004',
        label: 'Blood Pressure',
        type: 'text',
        required: false,
        options: [],
        sort_order: 4,
      },
      {
        id: 'a0000000-0000-0000-0000-000000000005',
        label: 'Symptoms',
        type: 'textarea',
        required: false,
        options: [],
        sort_order: 5,
      },
      {
        id: 'a0000000-0000-0000-0000-000000000006',
        label: 'Diagnosis',
        type: 'select',
        required: false,
        options: ['Malaria', 'Hypertension', 'Respiratory Infection', 'Diarrheal Disease', 'Diabetes', 'Skin Infection', 'Other'],
        sort_order: 6,
      },
      {
        id: 'a0000000-0000-0000-0000-000000000007',
        label: 'Medication Given',
        type: 'text',
        required: false,
        options: [],
        sort_order: 7,
      },
    ];
    await saveLocalFields(defaultFields);
  }
};

// Form Field Operations
export const getLocalFields = async (): Promise<FormField[]> => {
  const db = await initDB();
  const tx = db.transaction('form_fields', 'readonly');
  const index = tx.store.index('by-order');
  return index.getAll();
};

export const saveLocalField = async (field: FormField): Promise<string> => {
  const db = await initDB();
  await db.put('form_fields', field);
  return field.id;
};

export const saveLocalFields = async (fields: FormField[]): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction('form_fields', 'readwrite');
  await Promise.all([
    ...fields.map((field) => tx.store.put(field)),
    tx.done,
  ]);
};

export const deleteLocalField = async (id: string): Promise<void> => {
  const db = await initDB();
  await db.delete('form_fields', id);
};

export const clearLocalFields = async (): Promise<void> => {
  const db = await initDB();
  await db.clear('form_fields');
};

// Submission Operations
export const getLocalSubmissions = async (): Promise<PatientSubmission[]> => {
  const db = await initDB();
  const tx = db.transaction('submissions', 'readonly');
  const index = tx.store.index('by-date');
  const submissions = await index.getAll();
  // Return reversed to have newest first
  return submissions.reverse();
};

export const getUnsyncedSubmissions = async (): Promise<PatientSubmission[]> => {
  const db = await initDB();
  const index = db.transaction('submissions', 'readonly').store.index('by-sync-status');
  return index.getAll(0); // 0 stands for unsynced
};

export const saveLocalSubmission = async (submission: PatientSubmission): Promise<string> => {
  const db = await initDB();
  await db.put('submissions', submission);
  return submission.id;
};

export const saveLocalSubmissions = async (submissions: PatientSubmission[]): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction('submissions', 'readwrite');
  await Promise.all([
    ...submissions.map((sub) => tx.store.put(sub)),
    tx.done,
  ]);
};

export const markSubmissionSynced = async (id: string): Promise<void> => {
  const db = await initDB();
  const sub = await db.get('submissions', id);
  if (sub) {
    sub.synced = 1;
    await db.put('submissions', sub);
  }
};

export const deleteLocalSubmission = async (id: string): Promise<void> => {
  const db = await initDB();
  await db.delete('submissions', id);
};

export const clearLocalSubmissions = async (): Promise<void> => {
  const db = await initDB();
  await db.clear('submissions');
};
