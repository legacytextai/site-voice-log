

## Plan: Store Transcripts as Text Files in Storage Bucket

### Overview
Create a `transcripts` storage bucket and save each voice log transcript as a `.txt` file organized by date and user email: `YYYY-MM-DD/{user-email}/transcript-{log-id}.txt`.

### Changes

**1. Database migration — create storage bucket + RLS policies**
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('transcripts', 'transcripts', false);

CREATE POLICY "Public read transcripts" ON storage.objects FOR SELECT TO public USING (bucket_id = 'transcripts');
CREATE POLICY "Service insert transcripts" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'transcripts');
```

**2. `supabase/functions/generate-report/index.ts`**
After each transcript is produced (or read from existing data), upload it to the `transcripts` bucket:
- Path format: `{YYYY-MM-DD}/{user-email}/{log-id}.txt`
- Use the user email fetched from the `users` table (already available in the function)
- Use the log's `recorded_at` date for the date folder
- Upload with `contentType: "text/plain"` and `upsert: true`
- Do this for every log in the batch — both newly transcribed and previously transcribed logs

No other files change. Existing transcription, report generation, and upload logic remain untouched.

### Files
| File | Change |
|------|--------|
| Migration SQL | Create `transcripts` bucket + RLS policies |
| `supabase/functions/generate-report/index.ts` | After transcript is available, upload `.txt` file to `transcripts` bucket |

