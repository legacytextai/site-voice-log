

## Plan: Fix iOS Safari Auto-Zoom on Input Focus

### Problem
iOS Safari automatically zooms in when a user focuses an input with a font-size smaller than 16px. The page stays zoomed after submission, causing the onboarding dialog to appear clipped.

### Fix — `index.html`

Update the viewport meta tag to prevent iOS auto-zoom:

```html
<!-- Before -->
<meta name="viewport" content="width=device-width, initial-scale=1.0" />

<!-- After -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
```

### Files
| File | Change |
|------|--------|
| `index.html` | Add `maximum-scale=1.0` to viewport meta tag |

One-line change. This prevents iOS from zooming on input focus while keeping the page responsive.

