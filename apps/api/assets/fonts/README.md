# Fonts

Pre-downloaded Google Fonts TTFs live here. Person 3 uses them for
social-post rendering; Person 4 embeds them in WeasyPrint CSS (the base
stylesheet imports via `@font-face` with `file://` URLs for offline
rendering).

## Expected families

| Family | Category | URL |
|---|---|---|
| Inter | sans | https://fonts.google.com/specimen/Inter |
| Space Grotesk | sans | https://fonts.google.com/specimen/Space+Grotesk |
| DM Sans | sans | https://fonts.google.com/specimen/DM+Sans |
| Manrope | sans | https://fonts.google.com/specimen/Manrope |
| Plus Jakarta Sans | sans | https://fonts.google.com/specimen/Plus+Jakarta+Sans |
| Fraunces | serif | https://fonts.google.com/specimen/Fraunces |
| Playfair Display | serif | https://fonts.google.com/specimen/Playfair+Display |
| Crimson Pro | serif | https://fonts.google.com/specimen/Crimson+Pro |
| EB Garamond | serif | https://fonts.google.com/specimen/EB+Garamond |
| JetBrains Mono | mono | https://fonts.google.com/specimen/JetBrains+Mono |
| IBM Plex Mono | mono | https://fonts.google.com/specimen/IBM+Plex+Mono |
| Bricolage Grotesque | display | https://fonts.google.com/specimen/Bricolage+Grotesque |
| Syne | display | https://fonts.google.com/specimen/Syne |
| Bebas Neue | display | https://fonts.google.com/specimen/Bebas+Neue |
| Archivo | sans | https://fonts.google.com/specimen/Archivo |
| Sora | sans | https://fonts.google.com/specimen/Sora |

## Layout

Drop each family as a folder with its TTFs at the top level:

```
fonts/
  Inter/
    Inter-Regular.ttf
    Inter-Bold.ttf
  SpaceGrotesk/
    SpaceGrotesk-Regular.ttf
    SpaceGrotesk-Bold.ttf
  ...
```

Weights required for brand guide: `400` (regular) and `700` (bold). Add
extras (italic, 300, 500, 900) as needed for a specific document.

## Fetching

If the directory is empty, the pipeline falls back to linking Google
Fonts via `<link rel="stylesheet">` / CSS `@import`. That works online
but embeds nothing in the PDF — fine for prototype, bad for offline
rendering.

To hydrate locally, download the TTFs from the URLs above and commit
them (Google Fonts is OFL-licensed; redistribution is permitted).
