

## Plan: Backend Date-Scoped Daily Workspace Support

### 1. Migration — `daily_reports` schema

```sql
ALTER TABLE daily_reports ADD COLUMN project_name text;

CREATE UNIQUE INDEX uq_daily_reports_user_date_project
  ON daily_reports(user_id, report_date, project_name);

CREATE INDEX idx_admin_reports_user_date_project
  ON admin_reports(user_id, report_date, project_name);
```

**Risk for existing rows**: Existing rows have `NULL` for `project_name`. The unique index allows multiple NULLs (Postgres treats NULLs as distinct in unique indexes), so no migration failure. However, the edge functions will need to handle NULL-safe matching going forward.

### 2. Update `generate-report` edge function

**Input change** (line 147):
- Accept optional `report_date` from request body
- If supplied, use it for `reportDate` and AI prompt date string
- If not supplied, default to `new Date()` (backward compatible)

**Row lookup changes** — add `.eq("project_name", projectName)` to all lookups:
- `daily_reports` lookup (lines 383-388 and 516-521)
- `admin_reports` lookup (lines 544-549)

**Insert changes**:
- Include `project_name` in `daily_reports` insert (lines 401-406 and 534-537)

**AI prompt date** (lines 416-418):
- Use `report_date` input (if provided) to format the date string instead of `new Date()`

### 3. Update `regenerate-report-pdf` edge function

**Row lookup changes** — add `.eq("project_name", project_name)` to:
- `daily_reports` lookup (lines 170-175)
- `admin_reports` lookup (lines 190-195)

### Technical Details

**Exact row matching after changes**:
- `daily_reports`: `user_id + report_date + project_name`
- `admin_reports`: `user_id + report_date + project_name`

**Files changed**:
1. New migration SQL file
2. `supabase/functions/generate-report/index.ts`
3. `supabase/functions/regenerate-report-pdf/index.ts`

**No changes to**: frontend, PDF formatting, transcription logic, AI prompt structure (beyond date), storage paths, RLS policies.

