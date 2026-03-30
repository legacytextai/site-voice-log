

## Plan: Add Diagnostic Instrumentation to Recording Flow

### Overview
Add temporary debug logging and an on-screen debug panel to diagnose the iPhone Safari recording failure. No codec fallback or upload logic changes.

### Changes

**1. `src/hooks/useVoiceRecorder.ts`** — Add debug log state and step-by-step instrumentation

- Add a `debugLogs` state array (`string[]`) exposed from the hook
- Wrap `startRecording` with numbered diagnostic steps, each appending to `debugLogs`:
  1. `"[1] Record button clicked"`
  2. `"[2] UserAgent: ..."` + `"MediaRecorder exists: true/false"`
  3. `"[3] isTypeSupported checks"` — log results for `audio/webm;codecs=opus`, `audio/mp4`, `audio/aac`
  4. `"[4] Requesting microphone access..."`
  5. `"[5] Microphone stream acquired"` (after `getUserMedia` resolves)
  6. `"[6] Creating MediaRecorder with audio/webm;codecs=opus"`
  7. `"[7] MediaRecorder created successfully"`
  8. `"[8] Calling recorder.start()"`
  9. `"[9] Recorder started, state: <state>"`
- On any error in the catch block: `"[ERR] <error.name>: <error.message>"` + full error logged to console
- Add `mediaRecorder.onerror` handler logging `"[ERR] MediaRecorder.onerror: ..."`
- Return `debugLogs` from the hook

**2. `src/pages/Index.tsx`** — Add collapsible debug panel

- Destructure `debugLogs` from `useVoiceRecorder`
- Add a small toggle button labeled "Debug" in the header (next to Sign Out)
- When expanded, render a fixed-bottom panel with monospace text showing all debug log entries, scrollable, semi-transparent dark background
- Show a toast on recording error: "Recording failed — check debug panel"

### Files
| File | Change |
|------|--------|
| `src/hooks/useVoiceRecorder.ts` | Add `debugLogs` state, instrument each step of `startRecording`, add `onerror` handler |
| `src/pages/Index.tsx` | Consume `debugLogs`, add toggle-able debug panel, show toast on error |

### Notes
- All diagnostics are temporary — designed to be removed once the root cause is confirmed
- No changes to mimeType, upload logic, or blob handling
- Debug panel is visible on-device without dev tools, critical for iPhone Safari testing

