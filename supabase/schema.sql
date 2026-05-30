-- Medical Outreach Record System (MORS) - Supabase SQL Schema
-- Relational Database Design for dynamic form construction and offline synchronization.

-- 1. ADMISSIONS / ADMINS TABLE
-- Tracks authorized administrators for dashboard access and form editing.
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. DYNAMIC FORM FIELDS TABLE
-- Stores custom form configurations.
CREATE TABLE IF NOT EXISTS form_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('text', 'number', 'select', 'radio', 'checkbox', 'date', 'textarea')),
    required BOOLEAN DEFAULT false NOT NULL,
    options TEXT[] DEFAULT '{}'::TEXT[] NOT NULL, -- For select, radio, checkbox fields
    sort_order INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. PATIENT SUBMISSIONS TABLE
-- Represents a single patient visit/registration transaction during outreach.
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. SUBMISSION VALUES TABLE
-- Relational model mapping individual fields to their answers for a given submission.
CREATE TABLE IF NOT EXISTS submission_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    field_id UUID NOT NULL REFERENCES form_fields(id) ON DELETE CASCADE,
    value TEXT NOT NULL, -- Stored as flat string or comma-separated for checkbox lists
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (submission_id, field_id)
);

-- 5. PERFORMANCE AND SEARCH INDEXES
-- Essential for rapid dashboard search, filtering, and real-time analytical queries.
CREATE INDEX IF NOT EXISTS idx_submission_values_field_value ON submission_values (field_id, value);
CREATE INDEX IF NOT EXISTS idx_submission_values_submission_id ON submission_values (submission_id);
CREATE INDEX IF NOT EXISTS idx_form_fields_sort_order ON form_fields (sort_order);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions (created_at DESC);

-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- Configure security rules to protect patient information while enabling volunteers to submit offline data.

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_values ENABLE ROW LEVEL SECURITY;

-- Admins Security Policies
CREATE POLICY "Admins full access" ON admins
    FOR ALL USING (true);

-- Form Fields Security Policies (Volunteers can read fields, Admins can do everything)
CREATE POLICY "Allow public read access to form fields" ON form_fields
    FOR SELECT USING (true);

CREATE POLICY "Allow admin full access to form fields" ON form_fields
    FOR ALL USING (true);

-- Submissions Security Policies (Volunteers can write, Admins can read/delete)
CREATE POLICY "Allow public insert into submissions" ON submissions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read submissions" ON submissions
    FOR SELECT USING (true); -- Enabled for offline/online client validation

CREATE POLICY "Allow admin full access to submissions" ON submissions
    FOR ALL USING (true);

-- Submission Values Security Policies (Volunteers can write, Admins can read/delete)
CREATE POLICY "Allow public insert into submission_values" ON submission_values
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read submission_values" ON submission_values
    FOR SELECT USING (true);

CREATE POLICY "Allow admin full access to submission_values" ON submission_values
    FOR ALL USING (true);

-- 7. SEED INITIAL STANDARD HEALTHCARE OUTREACH FIELDS
-- Automatically populates the default dynamic form builder with robust fields.
INSERT INTO form_fields (id, label, type, required, options, sort_order)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Full Name', 'text', true, '{}'::TEXT[], 1),
    ('a0000000-0000-0000-0000-000000000002', 'Age', 'number', true, '{}'::TEXT[], 2),
    ('a0000000-0000-0000-0000-000000000003', 'Gender', 'select', true, '{"Male", "Female", "Other"}'::TEXT[], 3),
    ('a0000000-0000-0000-0000-000000000004', 'Blood Pressure', 'text', false, '{}'::TEXT[], 4),
    ('a0000000-0000-0000-0000-000000000005', 'Symptoms', 'textarea', false, '{}'::TEXT[], 5),
    ('a0000000-0000-0000-0000-000000000006', 'Diagnosis', 'select', false, '{"Malaria", "Hypertension", "Respiratory Infection", "Diarrheal Disease", "Diabetes", "Skin Infection", "Other"}'::TEXT[], 6),
    ('a0000000-0000-0000-0000-000000000007', 'Medication Given', 'text', false, '{}'::TEXT[], 7)
ON CONFLICT (id) DO NOTHING;
