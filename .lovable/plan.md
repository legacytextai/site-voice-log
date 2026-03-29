

## Plan: Rename PDF Files to `[ProjectName]_Daily Report_[Date].pdf`

### Changes

**`supabase/functions/generate-report/index.ts`** — Update the `pdfPath` variable:

Current: `${reportDate}/${user_id}.pdf`  
New: `${reportDate}/${sanitizedProjectName}_Daily Report_${reportDate}.pdf`

Sanitize the project name by replacing non-alphanumeric characters (except spaces/hyphens) and trimming, to ensure valid file paths.

**`src/components/ReportSection.tsx`** — Update the download filename:

Current: `SiteLog_Report_${date}.pdf`  
New: `${projectName}_Daily Report_${date}.pdf`

### Files
| File | Change |
|------|--------|
| `supabase/functions/generate-report/index.ts` | Update `pdfPath` to use `[ProjectName]_Daily Report_[Date].pdf` |
| `src/components/ReportSection.tsx` | Update `a.download` filename to match |

