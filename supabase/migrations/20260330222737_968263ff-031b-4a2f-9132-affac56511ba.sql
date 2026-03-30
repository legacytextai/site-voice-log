INSERT INTO storage.buckets (id, name, public) VALUES ('transcripts', 'transcripts', false);

CREATE POLICY "Public read transcripts" ON storage.objects FOR SELECT TO public USING (bucket_id = 'transcripts');
CREATE POLICY "Service insert transcripts" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'transcripts');