

## Email Identity + Report Actions + Admin PDF Storage — Implementation Plan

### What We're Building

1. **Email identity** — users enter email once, get remembered via localStorage
2. **Data association** — all voice logs and reports tied to user
3. **Report generation with PDF** — single canonical PDF per user per day, upsert behavior
4. **Report actions** — Download PDF, Copy Report, Email Report (all reuse existing PDF)
5. **Admin reports table** — one row per user per day for manual end-of-day emailing

---

### Database Migration

```sql
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
```

---

### Frontend Changes

#### New: `src/hooks/useUser.ts`
- On mount: check `localStorage` for `sitelog_user_id`
- If found: fetch user from `users` table, set state
- If not found: `user = null` → triggers email screen
- `login(email)`: upsert into `users` (insert on conflict do nothing, then select by email), store id in localStorage
- Exports `{ user, login, isLoading }`

#### New: `src/components/EmailEntry.tsx`
- Single email input + "Continue" button
- Basic email regex validation
- Minimal styling matching existing design language
- Calls `login(email)` on submit

#### Modified: `src/pages/Index.tsx`
- Use `useUser` hook at top level
- No user → render `<EmailEntry />`
- User loaded → render main screen
- Pass `userId` to `useVoiceRecorder` and report generation
- Pass `userEmail` to ReportSection for mailto
- Track `pdfUrl` in state alongside `report`

#### Modified: `src/hooks/useVoiceRecorder.ts`
- Accept `userId` parameter
- Include `user_id` in voice_logs insert
- Filter today's logs query by `user_id`

#### Modified: `src/components/ReportSection.tsx`
- After report displays, show three action buttons:
  - **Download PDF** — fetch existing `pdfUrl`, trigger browser download
  - **Copy Report** — `navigator.clipboard.writeText(report)` with toast
  - **Email Report** — `mailto:` link prefilled with user email, subject "SiteLog Daily Report – [date]", body = report text

---

### Edge Function Changes

#### Modified: `supabase/functions/generate-report/index.ts`
- Accept `user_id` in request body
- After generating report text via AI:
  - **Upsert** `daily_reports` (on conflict `user_id, report_date` → update content, pdf_url, log_ids)
  - Generate PDF using simple text-to-PDF (construct minimal PDF bytes inline or use a lightweight approach)
  - Upload PDF to `report-pdfs/{date}/{user_id}.pdf` (deterministic path, upsert/overwrite)
  - Build public URL for the PDF
  - Update `daily_reports.pdf_url`
  - **Upsert** `admin_reports` (on conflict `user_id, report_date` → update pdf_url, user_email; preserve status if already 'sent')
- Return `{ report: { content, pdf_url } }`

#### PDF Generation Approach
Generate the PDF server-side within the edge function. Use a minimal approach: either construct raw PDF bytes programmatically (a simple text PDF is ~50 lines of code) or use a lightweight Deno-compatible library. The PDF will contain the structured report text in a clean, readable format.

---

### File Summary

| File | Action |
|------|--------|
| `src/hooks/useUser.ts` | Create |
| `src/components/EmailEntry.tsx` | Create |
| `src/pages/Index.tsx` | Modify |
| `src/hooks/useVoiceRecorder.ts` | Modify |
| `src/components/ReportSection.tsx` | Modify |
| `supabase/functions/generate-report/index.ts` | Modify |
| New migration SQL | Create |

