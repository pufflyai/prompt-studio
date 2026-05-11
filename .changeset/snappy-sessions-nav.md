---
"@pstdio/ui": patch
"pstdio": patch
---

Make navigating between the project panels feel instant even with hundreds of sessions and many tickets.

- `Sidebar` gains an opt-in `virtualize` prop that virtualizes the inner `TreeList` rows via `@tanstack/react-virtual`; the sessions sidebar opts in to keep render cost flat as session count grows.
- The sessions panel defers mounting the heavy `SessionChatView` subtree one frame after the panel chrome paints.
- The tickets panel renders its chrome immediately (no more blocking "Loading…" gate) and defers the heavy board view one frame so back-navigation from sessions/workspace feels instant.
- The project shell narrows `useRouterState` to a `location` selector so it does not re-render on unrelated router state changes.
