

## Update URLs: fieldlog.lovable.app → fieldlogapp.lovable.app

Two files need updating:

**supabase/config.toml** (lines 4-5)
- `site_url` → `https://fieldlogapp.lovable.app`
- `additional_redirect_urls` → `https://fieldlogapp.lovable.app/reset-password`

**src/hooks/useUser.ts** (line 61)
- `redirectTo` → `https://fieldlogapp.lovable.app/reset-password`

Total: 2 files, 3 string replacements.

