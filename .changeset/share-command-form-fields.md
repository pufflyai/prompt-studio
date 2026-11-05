---
"pstdio": patch
"@pstdio/ui": minor
"@pstdio/workbench": patch
---

Expose reusable command form fields and dynamic options through the public UI package so extensions can render provider forms without depending on Workbench. Preserve Workbench's contextual defaults and field renderer API. Keep the selected panel open when a webview updates its page parameters. Preserve the acted-on resource's owner during shared mutation confirmation, and reveal new inline inputs in long trees.

Keep sidebar drag targets inside their visible scroll viewport so virtualized rows cannot intercept moves into an empty header or footer.

Load complete lazy folder contents after optimistic moves and retain expanded branches when a provider snapshot refreshes.
