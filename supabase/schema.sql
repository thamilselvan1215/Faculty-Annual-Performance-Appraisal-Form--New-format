-- ============================================================================
-- MANAKULA VINAYAGAR INSTITUTE OF TECHNOLOGY (MVIT)
-- Faculty Performance Appraisal System - Supabase Schema
-- ============================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PAR Reports Table (Faculty Performance Appraisal Report - FPI System)
CREATE TABLE IF NOT EXISTS public.par_reports (
    id TEXT PRIMARY KEY,
    faculty_id TEXT,
    faculty_name TEXT NOT NULL,
    department TEXT,
    designation TEXT,
    academic_year TEXT NOT NULL,
    fpi NUMERIC(5, 3),
    status TEXT NOT NULL DEFAULT 'Draft',
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_par_reports_faculty_name ON public.par_reports(faculty_name);
CREATE INDEX IF NOT EXISTS idx_par_reports_academic_year ON public.par_reports(academic_year);
CREATE INDEX IF NOT EXISTS idx_par_reports_status ON public.par_reports(status);
CREATE INDEX IF NOT EXISTS idx_par_reports_department ON public.par_reports(department);

-- 2. Designation Weights Configuration Table
CREATE TABLE IF NOT EXISTS public.par_weight_configs (
    id TEXT PRIMARY KEY,
    designation TEXT NOT NULL,
    faculty_category TEXT,
    w10 NUMERIC(4, 2) NOT NULL,
    w20 NUMERIC(4, 2) NOT NULL,
    w30 NUMERIC(4, 2) NOT NULL,
    w40 NUMERIC(4, 2) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    description TEXT,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Seed default weight configurations
INSERT INTO public.par_weight_configs (id, designation, faculty_category, w10, w20, w30, w40, is_default, description)
VALUES 
    ('wt_asst_prof', 'ASSISTANT PROFESSOR', 'Engineering Faculty', 0.60, 0.15, 0.15, 0.10, true, 'Standard weights for Assistant Professor (MVIT Reference Document)'),
    ('wt_assoc_prof', 'ASSOCIATE PROFESSOR', 'Engineering Faculty', 0.50, 0.20, 0.15, 0.15, false, 'Standard weights for Associate Professor / Senior Assistant Professor'),
    ('wt_professor', 'PROFESSOR', 'Engineering Faculty', 0.40, 0.30, 0.15, 0.15, false, 'Standard weights for Professor with higher Research emphasis')
ON CONFLICT (id) DO UPDATE SET
    w10 = EXCLUDED.w10,
    w20 = EXCLUDED.w20,
    w30 = EXCLUDED.w30,
    w40 = EXCLUDED.w40,
    description = EXCLUDED.description;

-- 3. FPAS Form Records Table (700 Marks System)
CREATE TABLE IF NOT EXISTS public.fpas_records (
    id TEXT PRIMARY KEY,
    academic_year TEXT,
    faculty_name TEXT,
    empid TEXT,
    designation TEXT,
    department TEXT,
    form_data JSONB NOT NULL,
    total_awarded NUMERIC(6, 2),
    percentage NUMERIC(5, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_fpas_faculty_name ON public.fpas_records(faculty_name);
CREATE INDEX IF NOT EXISTS idx_fpas_empid ON public.fpas_records(empid);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.par_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.par_weight_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpas_records ENABLE ROW LEVEL SECURITY;

-- 5. Open Access Policies for Portal Anon Key (Allows client-side sync)
-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Allow anon all on par_reports" ON public.par_reports;
CREATE POLICY "Allow anon all on par_reports" ON public.par_reports
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on par_weight_configs" ON public.par_weight_configs;
CREATE POLICY "Allow anon all on par_weight_configs" ON public.par_weight_configs
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on fpas_records" ON public.fpas_records;
CREATE POLICY "Allow anon all on fpas_records" ON public.fpas_records
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 6. Storage Bucket for Appraisal Evidence Attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('appraisal-evidence', 'appraisal-evidence', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow public evidence uploads" ON storage.objects;
CREATE POLICY "Allow public evidence uploads" ON storage.objects
    FOR ALL
    TO anon, authenticated
    USING (bucket_id = 'appraisal-evidence')
    WITH CHECK (bucket_id = 'appraisal-evidence');
