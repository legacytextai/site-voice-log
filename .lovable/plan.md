

## Plan: Generate a Project Brief PDF

Create a PDF document summarizing the SiteLog project and everything completed, saved to `/mnt/documents/`.

### Project Summary (content for the brief)

**SiteLog** is a mobile-first web application for construction site workers to record daily voice logs and generate formal daily site reports.

### Completed Features

1. **Email-based authentication** -- Simple email login (no password), user persistence via localStorage, automatic user creation on first login
2. **Project/Job field** -- Editable project name field with auto-save (debounced), persisted per user
3. **Voice recording** -- Tap-to-record button, WebM/Opus audio capture, automatic upload to cloud storage
4. **Voice log management** -- Today's logs displayed with timestamps and durations, saving/saved status indicators
5. **AI-powered transcription** -- Audio transcribed via Gemini 2.5 Flash, construction-site-aware transcription
6. **AI-powered report generation** -- Structured daily site reports generated from transcripts (Gemini 3 Flash Preview), includes: Weather, Work Performed, Materials, Personnel, Safety, Issues, Notes
7. **PDF generation and storage** -- Server-side PDF creation, uploaded to cloud storage, named `[ProjectName]_Daily Report_[Date].pdf`
8. **Report actions** -- Download PDF, Copy Report to clipboard, Email Report (mailto with body + PDF link)
9. **Admin reports tracking** -- `admin_reports` table tracks report status per user per day
10. **Onboarding dialog** -- First-time user quick-start instructions, shown once after first login
11. **Sign out** -- Clears session, returns to email entry; re-entering same email restores user data
12. **iOS Safari zoom fix** -- Viewport `maximum-scale=1.0` prevents auto-zoom on input focus

### Technical Implementation

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Lovable Cloud (4 tables: `users`, `voice_logs`, `daily_reports`, `admin_reports`)
- **Storage**: `recordings` bucket (audio), `report-pdfs` bucket (generated PDFs)
- **Edge Function**: `generate-report` -- handles transcription, report generation, PDF creation, and storage
- **AI Models**: Gemini 2.5 Flash (transcription), Gemini 3 Flash Preview (report generation)

### Approach

Generate a clean, professional PDF using ReportLab with the above content, then QA visually.

### Files
No project files modified -- this is a standalone artifact generation task.

