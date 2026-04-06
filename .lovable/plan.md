

## Plan: New `regenerate-report-pdf` Edge Function

### Recommended Function Name
`regenerate-report-pdf`

### Input Contract
```json
{
  "user_id": "uuid (required)",
  "project_name": "string (required)",
  "report_date": "YYYY-MM-DD (required)",
  "content": "string — full final edited report text (required)"
}
```
No `daily_report_id` needed — the existing `generate-report` function already identifies rows by `user_id + report_date`, which is reliable and consistent.

### Reused Logic vs New Logic
- **Reused**: The `generatePdfBytes(title, content)` function will be **copied verbatim** from `generate-report/index.ts` into the new function. This avoids any coupling or risk to the existing function. The function is self-contained (~100 lines) and includes the Helvetica footer, footer reserve, and all current formatting.
- **New**: Input validation, the persistence update logic, and the CORS/serve wrapper.

Shared-module extraction is possible but introduces deployment coupling risk — copying is safer for a surgical addition.

### Persistence Update Plan
1. **`daily_reports`**: Find row by `user_id + report_date`. If found, update `content` and `pdf_url`. If not found, do nothing (don't insert — this function is for *re*generation of existing reports).
2. **`admin_reports`**: Find row by `user_id + report_date`. If found, update `pdf_url` only. If status is not `"sent"`, set to `"pending_sent"`.

This mirrors the existing upsert logic in `generate-report` but is update-only.

### PDF Upload Path
Reuses the existing convention:
```
{report_date}/{SanitizedProjectName}_Daily Report_{report_date}.pdf
```
With `upsert: true`, so it overwrites the previous PDF for that date/project.

### Files To Create/Change
1. **`supabase/functions/regenerate-report-pdf/index.ts`** — new file (only file)

No other files changed. No schema changes. No frontend changes.

### Risks / Edge Cases
- **No matching `daily_reports` row**: If the app calls this before a report was ever generated, there's nothing to update. The function will still generate and upload the PDF and return the URL, but won't persist to `daily_reports`. This is acceptable — the caller can handle it.
- **PDF overwrite**: Uses `upsert: true` on the same storage path, so the old PDF is replaced. This is intended behavior.
- **`generatePdfBytes` duplication**: Two copies exist. If the PDF generator changes in the future, both must be updated. Acceptable tradeoff for zero-risk isolation.

