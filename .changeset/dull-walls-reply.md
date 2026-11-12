---
"pstdio": patch
"@pstdio/sdk": patch
"@pstdio/ui": patch
"@pstdio/workbench": patch
"pstdio-session-browser": patch
"pstdio-home": patch
"pstdio-planner": patch
"pstdio-cloud": patch
---

Keep sessions and navigation within reach: show a solid trailing dot only for activity since the session was last opened, refresh session pins without waiting for unrelated resources, open resource and collection pages by dragging, reopen closed tabs, and preview complete shortcuts in open menus. Add project-tab settings actions, compact Cloud status, fix retained Home reads and editor toolbars, and show nonempty linked-resource groups with relationships discoverable from either end. Expose session links through a right panel menu that follows attached and floating sessions and hides when empty; keep session navigation focused on conversations and keep the Side launcher floating above Main. Deliver streaming refresh events immediately so opening a session clears its larger activity dot and suppress it while the session is visible, and hide empty chat attachment trays.
