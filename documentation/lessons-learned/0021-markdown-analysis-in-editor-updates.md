# Reuse Markdown analysis while typing

## 1. When to use

- Bridging rich-text editors to lossless Markdown and shared text.
- Mapping caret positions or preserving source syntax during editor updates.

## 2. Failure

- A shared editor exported the same state repeatedly for persistence, tables and caret mapping.
- Source mapping parsed identical text spans, and each source export reparsed the unchanged loaded source and baseline.
- Sync correctness tests passed while typing became slower as documents grew.

## 3. Prevention

- Keep visible typing immediate; batch expensive publication after a pause and periodically during continuous input.
- Export once per publication and share that snapshot with its consumers.
- Drain pending text at receive, close, unload, undo and composition boundaries. Keep private IME text when public write permission changes.
- Group Undo by input activity, rather than the interval between published batches.
- Map identical strings directly without syntax analysis.
- Keep parsed source analysis within its owning document. Retain loaded spellings and only the latest changing snapshot; replace it when the source is imported or reconciled.
- Profile typing with a representative document. Verify full input, caret/focus, and persistence as well as frame timing.
- Keep source spelling, reference links, tables, composition and concurrent edits covered when changing analysis.

## 4. Evidence

- [Collaboration binding](../../packages/ui/src/components/rich-text/markdown-editor/plugins/markdown-collaboration-binding.ts)
- [Source document regression](../../packages/ui/src/components/rich-text/shared/markdown-source-document.p0.test.ts)
- [Identity mapping regression](../../packages/ui/src/components/rich-text/shared/markdown-source-map.p0.test.ts)
- [Bounded analysis lifetime](../../packages/ui/src/components/rich-text/shared/markdown-source-parser.p0.test.ts)
