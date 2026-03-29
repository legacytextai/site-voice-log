
-- Create storage bucket for audio recordings (public so we can read them from edge functions)
INSERT INTO storage.buckets (id, name, public) VALUES ('recordings', 'recordings', false);

-- Allow anonymous uploads to recordings bucket (no auth in this app)
CREATE POLICY "Anyone can upload recordings"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'recordings');

CREATE POLICY "Anyone can read recordings"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'recordings');

-- Create table for voice logs
CREATE TABLE public.voice_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  duration_seconds INTEGER NOT NULL,
  audio_path TEXT NOT NULL,
  transcript TEXT,
  status TEXT NOT NULL DEFAULT 'saving' CHECK (status IN ('saving', 'saved', 'transcribing', 'transcribed', 'error')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.voice_logs ENABLE ROW LEVEL SECURITY;

-- No auth — allow all operations for now (unique link access model)
CREATE POLICY "Anyone can read voice logs"
  ON public.voice_logs FOR SELECT USING (true);

CREATE POLICY "Anyone can insert voice logs"
  ON public.voice_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update voice logs"
  ON public.voice_logs FOR UPDATE USING (true);

-- Create daily reports table
CREATE TABLE public.daily_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  content TEXT NOT NULL,
  log_ids UUID[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read daily reports"
  ON public.daily_reports FOR SELECT USING (true);

CREATE POLICY "Anyone can insert daily reports"
  ON public.daily_reports FOR INSERT WITH CHECK (true);
