

## Apply Migration: Add `project_name` to `voice_logs`

### Migration SQL

```sql
ALTER TABLE voice_logs ADD COLUMN project_name text;
```

### Scope
- **Single migration** — one `ALTER TABLE` statement
- **No other changes** — no edge functions, no frontend, no RLS, no other tables

### Post-migration confirmation
1. Migration succeeds (additive, no constraints)
2. Column exists as nullable text — verified via `SELECT column_name FROM information_schema.columns WHERE table_name = 'voice_logs' AND column_name = 'project_name'`
3. No RLS changes needed (existing policies use `true` and don't reference specific columns)
4. No edge function changes needed (`generate-report` doesn't reference this column)
5. Existing rows get `NULL` for `project_name` — fully backward-compatible

