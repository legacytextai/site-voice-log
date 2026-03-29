-- 1. Users table
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_insert" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "public_select" ON public.users FOR SELECT USING (true);

-- 2. Add user_id + pdf_url to existing tables (nullable for existing rows)
ALTER TABLE public.voice_logs ADD COLUMN user_id uuid REFERENCES public.users(id);
ALTER TABLE public.daily_reports ADD COLUMN user_id uuid REFERENCES public.users(id);
ALTER TABLE public.daily_reports ADD COLUMN pdf_url text;

-- 3. Unique constraint for upsert: one report per user per day
ALTER TABLE public.daily_reports ADD CONSTRAINT daily_reports_user_date_unique
  UNIQUE (user_id, report_date);

-- 4. Update policy for daily_reports (needed for upsert)
CREATE POLICY "Anyone can update daily reports" ON public.daily_reports
  FOR UPDATE USING (true);

-- 5. Admin reports table
CREATE TABLE public.admin_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) NOT NULL,
  user_email text NOT NULL,
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  pdf_url text,
  project_name text,
  status text NOT NULL DEFAULT 'pending_sent',
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, report_date)
);
ALTER TABLE public.admin_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_insert_admin" ON public.admin_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "public_select_admin" ON public.admin_reports FOR SELECT USING (true);
CREATE POLICY "public_update_admin" ON public.admin_reports FOR UPDATE USING (true);

-- 6. Report PDFs storage bucket (public for download)
INSERT INTO storage.buckets (id, name, public) VALUES ('report-pdfs', 'report-pdfs', true);
CREATE POLICY "public_upload_pdfs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'report-pdfs');
CREATE POLICY "public_read_pdfs" ON storage.objects FOR SELECT USING (bucket_id = 'report-pdfs');
CREATE POLICY "public_update_pdfs" ON storage.objects FOR UPDATE USING (bucket_id = 'report-pdfs');