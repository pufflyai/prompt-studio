---
"pstdio": patch
---

Bundle installed extension entries before importing them in the packaged binary so extensions that depend on `@pstdio/sdk` (or any dependency exposed through an `exports` subpath) load correctly; first-project creation no longer fails with an internal server error.
