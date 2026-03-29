

## Plan: Add Persistent Project Name Field

### Overview
Add a single editable "Project / Job #" input to the top of the main screen. It auto-saves on blur and after a debounce, persists in the `users` table, and feeds into report generation, PDF, and email subject.

---

### 1. Database Migration

Add `project_name` column to `users` table. Also add an UPDATE RLS policy (currently missing).

```sql
ALTER TABLE public.users ADD COLUMN project_name text;

CREATE POLICY "public_update" ON public.users
  FOR UPDATE USING (true);
```

---

### 2. Frontend: `useUser.ts`

- Expand `User` interface to include `project_name: string | null`
- Fetch `project_name` alongside `id, email` on load
- Add `updateProjectName(name: string)` callback that updates the `users` row and local state
- Return `{ user, login, updateProjectName, isLoading }`

---

### 3. Frontend: New `ProjectField.tsx` component

- Renders a label "Project / Job #" + text input with placeholder "Sunset Villas – PW-24-018"
- Controlled value from `user.project_name`
- Auto-saves on blur via `updateProjectName`
- Also auto-saves via 800ms debounce on typing
- After save, shows small "Saved" text that fades after 1.5s
- No save button

---

### 4. Frontend: `Index.tsx`

- Import and render `<ProjectField>` in the header area, above the date
- Pass `user.project_name` and `updateProjectName` as props
- Pass `user.project_name` (or fallback "Untitled Project") to `handleGenerateReport` and to `ReportSection`

---

### 5. Frontend: `ReportSection.tsx`

- Accept `projectName` prop
- Use it in email subject: `SiteLog Daily Report – ${projectName} – ${date}`

---

### 6. Edge Function: `generate-report/index.ts`

- Accept `project_name` in request body
- Include `PROJECT: {project_name}` line in the report prompt (right after the date header)
- Use project name in PDF title
- Save `project_name` on the `admin_reports` upsert

---

### Files Changed

| File | Action |
|------|--------|
| Migration SQL | Create — add `project_name` to users + UPDATE policy |
| `src/hooks/useUser.ts` | Modify — add `project_name` to User, add `updateProjectName` |
| `src/components/ProjectField.tsx` | Create — editable input with auto-save |
| `src/pages/Index.tsx` | Modify — render ProjectField, pass project_name to report flow |
| `src/components/ReportSection.tsx` | Modify — use projectName in email subject |
| `supabase/functions/generate-report/index.ts` | Modify — accept & use project_name |

