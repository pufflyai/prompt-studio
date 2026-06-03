---
"@pstdio/ui": minor
---

TagSettingsPanel now loads and saves through react-query; consumers must render it inside a QueryClientProvider and pass a `queryKey`.
