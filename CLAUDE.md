# QuEDU

## Target Devices
Primary: Desktop (1024px+) and Tablet (768px+)

- Design CSS for 768px+ first; use `@media (max-width: ...)` for exceptions
- No `max-width: 480px` or any mobile-only narrow constraints
- Use horizontal space — avoid single-column centered layouts
- Centering: `max-width: 900px` (content) or `max-width: 1200px` (admin), with `margin: 0 auto`

## Tech Stack
- Firebase Firestore only — no backend server
- Vanilla HTML / CSS / JavaScript — no frameworks
- Sub-apps in `/apps/`, admin panel in `/admin/`
- Firebase compat SDK (`firebase-app-compat.js`, `firebase-firestore-compat.js`)

## Fonts & Style
- Chinese font: Noto Sans TC
- Monospace numbers: Courier New (math expressions, numeric inputs)
- Colors defined as CSS variables in each page's `:root` — no hardcoded color values
