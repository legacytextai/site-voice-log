

## Plan: Implement mimeType Fallback with Runtime Detection

### `src/hooks/useVoiceRecorder.ts`

**1. Add ref and helper:**
- Add `selectedMimeRef = useRef<string>("")`
- Add helper function to derive extension/contentType from a mimeType string:
  - Contains `mp4` → `.mp4` / `audio/mp4`
  - Contains `webm` → `.webm` / `audio/webm`
  - Default → `.webm` / `audio/webm`

**2. Replace hardcoded mimeType selection (around lines 75-82):**
- Check `isTypeSupported` in order: `audio/webm;codecs=opus` → `audio/mp4`
- If one matches, create `new MediaRecorder(stream, { mimeType: selected })`, store in `selectedMimeRef`
- If neither supported, create `new MediaRecorder(stream)` with no options, then read `mediaRecorder.mimeType` from the created instance and store that in `selectedMimeRef`
- Log the final runtime mimeType to debug panel

**3. Update `onstop` handler:**
- Blob type: use `selectedMimeRef.current` (line ~99)
- File extension: derive from `selectedMimeRef.current` using the helper
- Upload `contentType`: derive from `selectedMimeRef.current` using the helper
- Update `audioPath` to use dynamic extension instead of hardcoded `.webm`

### No other files change. Debug panel preserved as-is.

### Files
| File | Change |
|------|--------|
| `src/hooks/useVoiceRecorder.ts` | mimeType negotiation with runtime detection, dynamic Blob/extension/contentType |

