---
"pstdio": minor
---

Project templates now override same-named extension-contributed templates for that project only (resolved by name); a default set on the shadowed extension template follows the name onto the override. Editing an extension-contributed template's content now forks it into a project template instead of failing, so saved edits persist for that project.
