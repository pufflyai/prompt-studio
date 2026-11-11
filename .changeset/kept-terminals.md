---
"pstdio": minor
"@pstdio/workbench": minor
---

Terminal panels keep running when their workbench closes, such as after closing a desktop project tab or reloading the page, and reopening the panel resumes the same shell with its recent output. Workbench terminal openers receive the panel's binding key, and disposing a workbench detaches sessions whose adapter implements `detach`.
