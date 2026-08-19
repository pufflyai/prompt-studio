---
"@pstdio/workbench": patch
"@pstdio/ui": patch
"pstdio": patch
---

Fix ticket view UX: enum dropdowns are portaled so panels no longer clip them, tree node resources share the host's canonical URIs so reopening a ticket from the sidenav keeps its properties menu, navigation entries render above the active resource's tree, and reopened documents mount from a content cache instead of a spinner.
