# Editor selection actions

The editor owns text editing and source selection. Activity owns comments, and Sessions owns agent conversations. This follows RB1's product boundary and preserves the public extension contract under RB 6.A.32.

A command contributes an action with `menus: [{ slot: editorSlots.selection, icon: "sparkles" }]`. The native document renderer supplies `ctx.resource` and a captured `ctx.slot` with `id: editorSlots.selection.id`. Its `context.selection` has `text`, `start`, `end`, and an optional `documentPath`. Positions use one-based source lines and columns, including frontmatter. Text is bounded to 10,000 characters. The invocation retains its project and viewer guards when a parameter dialog or command moves focus away from the document.

Sessions owns the `Ask agent` contribution and converts the selection into draft context. It invokes `workbenchCommands.openSessionDraft` through a command navigation target with `{ text, label? }`. This opens a fresh unsent draft in the installed Sessions view; it never submits a message. Existing native browser draft storage owns its account, endpoint, project, provider, and resource scope. The command refuses to overwrite an existing draft.

For React consumers, `MarkdownEditor` exposes two composition points: `plugins` for components within its Lexical context, and `selectionToolbar` for additional floating toolbar content. `useMarkdownEditor()` is scoped to that editor and exposes selection capture, durable anchor reveal, highlight cleanup, and focus. Capture the selection before moving focus to another control. The generic UI package does not import Activity APIs or session commands.

Activity composes an anchored comment popover outside the editor package. It uses the shared Activity composer and resource activity API, and keeps the popup's unsent text separate from the feed's draft. Successful publication opens the document's Activity menu. A failed publication preserves the body and idempotency key for retry. Source anchors use relative document positions, so posted quotes remain revealable after surrounding edits. Comments are available only when the resource grants comment capability and the document has a shared text binding.

The selection slot and draft command require the SDK and host revision that introduces them. Extensions must declare the published SDK version before shipping; candidate package fixtures are development validation, not proof of published compatibility.
