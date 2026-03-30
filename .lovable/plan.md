

## Plan: Fix Silent Transcript Upload Failures

### Problem
The transcript uploads to the `transcripts` bucket are failing silently — no error logging around the `supabase.storage.from("transcripts").upload(...)` calls.

### Changes

**`supabase/functions/generate-report/index.ts`** — Add error logging around both transcript upload locations:

1. **Existing transcript upload (line ~232)**: Wrap in error check, log failures with `console.error`
2. **New transcript upload (line ~305 area)**: Same — add error logging

This will surface the actual failure reason (likely a permissions or path issue) in the edge function logs so we can fix the root cause on the next run.

Additionally, add a `console.log` at the start confirming the transcript upload path for debugging.

### Files
| File | Change |
|------|--------|
| `supabase/functions/generate-report/index.ts` | Add error logging around both transcript storage uploads |

