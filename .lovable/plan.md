

## Plan: Add PDF Link to Email Body

### Change
In `src/components/ReportSection.tsx`, update `handleEmail` to append the PDF download link at the bottom of the email body when `pdfUrl` is available.

### Detail

**File: `src/components/ReportSection.tsx` (line ~44)**

Change the body construction from:
```ts
const body = encodeURIComponent(report);
```
to:
```ts
const pdfLine = pdfUrl ? `\n\n---\nDownload PDF: ${pdfUrl}` : "";
const body = encodeURIComponent(report + pdfLine);
```

One line changed. The existing report text stays as-is in the email body; a PDF link is appended at the bottom when available.

