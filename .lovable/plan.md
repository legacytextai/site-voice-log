

## Plan: Add Delete Button to Voice Log Entries

### What Changes

**1. Database Migration** — Add DELETE RLS policy on `voice_logs` table (currently missing)

```sql
CREATE POLICY "Anyone can delete voice logs"
ON public.voice_logs FOR DELETE TO public USING (true);
```

**2. `src/components/LogEntry.tsx`** — Add trash icon button with confirmation

- Add `onDelete` callback prop
- Add `Trash2` icon from lucide-react next to the status text
- Only show trash icon when status is `"saved"` (not while saving)
- On click, show a simple confirm dialog before calling `onDelete(entry.id)`

**3. `src/components/LogList.tsx`** — Pass `onDelete` prop through to each `LogEntry`

**4. `src/hooks/useVoiceRecorder.ts`** — Add `deleteEntry` function

- Delete the audio file from `recordings` storage bucket using `audio_path`
- Delete the row from `voice_logs` table (which holds `transcript`, `audio_path`, `status`, etc. — all in one row)
- Remove the entry from local `entries` state

**5. `src/pages/Index.tsx`** — Wire `deleteEntry` from the hook through `LogList`

### Technical Details

- The `voice_logs` table already stores `transcript` and `audio_path` on the same row, so deleting the row removes both
- Audio file in storage is deleted via `supabase.storage.from("recordings").remove([audio_path])`
- Need to fetch `audio_path` from the database before deletion since `LogEntryData` doesn't currently include it

### Files Modified
- `src/components/LogEntry.tsx`
- `src/components/LogList.tsx`
- `src/hooks/useVoiceRecorder.ts`
- `src/pages/Index.tsx`
- New migration for DELETE RLS policy

