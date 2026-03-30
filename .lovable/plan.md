

## Plan: Fix Transcription Hallucination and Report Contamination

### Problem
Corrupted/empty audio files (1–2 seconds, ~0 bytes) produce hallucinated transcripts with invented names, dates, and construction details. These contaminate daily reports.

### Changes

#### 1. Edge Function — Transcription Guardrails (`supabase/functions/generate-report/index.ts`)

**Before transcription (line ~226):**
- Skip transcription if `duration_seconds < 3` — set transcript to `"Recording too short for reliable transcription."`
- Skip transcription if downloaded audio blob size < 1024 bytes — set transcript to `"No usable audio detected."`

**Transcription prompt (line ~275):**
Replace the system prompt with a stricter version:
```
You are a verbatim transcription engine. Transcribe ONLY speech that is clearly audible.
Rules:
- If no speech is detected, respond EXACTLY: "Unclear or no speech detected."
- Do NOT invent, infer, or fabricate any content.
- Do NOT generate plausible filler text.
- Output ONLY what was clearly spoken — nothing more.
```

**Post-transcription sanity check (after line ~311):**
- Calculate words-per-second ratio: `wordCount / duration_seconds`
- If ratio > 5 (physically impossible speaking rate), override transcript to `"Unreliable transcription — excluded from report."`

#### 2. Edge Function — Report Input Filtering (line ~224–325)

Before building the `transcripts[]` array for the report prompt, exclude any transcript matching these sentinel strings:
- `"Recording too short for reliable transcription."`
- `"No usable audio detected."`
- `"Unclear or no speech detected."`
- `"Unreliable transcription — excluded from report."`

If all transcripts are excluded, return a report with: `"No activities reported. No usable field logs recorded."`

#### 3. Edge Function — Strengthen Report Prompt (line ~352)

Add to the system prompt:
```
STRICT GROUNDING RULES:
- ONLY include information explicitly stated in the transcripts.
- NEVER infer, fabricate, or embellish names, dates, weather, activities, or events.
- If a section has no relevant transcript data, write "Not reported."
- Do NOT generate a plausible construction narrative — report ONLY what was said.
```

#### 4. No Client-Side Changes

Recording, upload, and UI logic remain untouched. All fixes are server-side in the single edge function.

### Files Modified
- `supabase/functions/generate-report/index.ts` — all changes in one file

### Deployment
Edge function will be redeployed and tested after changes.

