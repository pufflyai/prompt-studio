# Reuse Markdown analysis while typing

## 1. When to use

- Bridging rich-text editors to lossless Markdown and shared text.
- Mapping caret positions or preserving source syntax during editor updates.

## 2. Failure

- A shared editor exported the same state repeatedly for persistence, tables and caret mapping.
- Source mapping parsed identical text spans, and each source export reparsed the unchanged loaded source and baseline.
- Sync correctness tests passed while typing became slower as documents grew.
- Body-change events also refreshed every resource placement and replayed unchanged page ancestry, causing shell and shortcut menus to render again. Chromium-only checks missed the more severe Firefox cost.
- Draining buffered edits on every own acknowledgement created a receive/publish loop. After the first batch, submission followed receipt latency rather than the intended typing cadence.
- An inactive link editor measured the native caret and stored a new React selection on every keystroke. Its hidden UI still consumed rendering time while typing plain text.

## 3. Prevention

- Keep visible typing immediate; batch expensive publication after a pause and periodically during continuous input.
- Export once per publication and share that snapshot with its consumers.
- Drain pending text at receive, close, unload, undo and composition boundaries. Keep private IME text when public write permission changes.
- Group Undo by input activity, rather than the interval between published batches.
- Map identical strings directly without syntax analysis.
- Keep parsed source analysis within its owning document. Retain loaded spellings and only the latest changing snapshot; replace it when the source is imported or reconciled.
- Profile typing with a representative document. Verify full input, caret/focus, and persistence as well as frame timing.
- Reproduce the reported browser and document size. Check both slow and fast input; a good result in another browser does not close the regression.
- Keep resource refreshes idempotent across all matching retained and visible references. An unchanged primary reference must still repair a stale duplicate. Replay ancestry only when its resource, page, parameters, section or position changes.
- Keep all public receive callbacks, and let renderers retain their buffer only when incoming context proves unchanged text, history and write access. Probe CRDT text events rather than visible-string or state-vector equality: equal-string replacements and deletions still need a barrier.
- Keep inactive editing tools hidden and skip their caret geometry and selection-state updates. Verify that entering edit mode still captures the selection before focusing its input.
- Keep source spelling, reference links, tables, composition and concurrent edits covered when changing analysis.

## 4. Evidence

- [Collaboration binding](../../packages/ui/src/components/rich-text/markdown-editor/plugins/markdown-collaboration-binding.ts)
- [Source document regression](../../packages/ui/src/components/rich-text/shared/markdown-source-document.p0.test.ts)
- [Identity mapping regression](../../packages/ui/src/components/rich-text/shared/markdown-source-map.p0.test.ts)
- [Bounded analysis lifetime](../../packages/ui/src/components/rich-text/shared/markdown-source-parser.p0.test.ts)
