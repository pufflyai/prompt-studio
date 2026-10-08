# Temporary Codex history identity migration

Proposed: 2026-10-02

## Decision

Use native turn and item IDs for live events and history. Support Codex 0.159.3's protocol. Keep complete saved messages and host attachment references after native compaction.

## External limitation

Codex 0.139's live item IDs differ from its persisted history IDs. Earlier `codex exec` adapters also saved local run numbers instead of native turn IDs. Updating Codex cannot recover those missing identities from a Prompt Studio checkpoint. Exact identity matching for those old saved messages is impossible.

Ideally every saved message would carry the same identity as the native item. Matching equal text would be unsafe: repeated prompts and replies are valid.

## Temporary workaround

An extension-local migration treats the old checkpoint as the visible history authority. Before the first shared native ID, native history contributes only turns after the saved user-turn boundary. Once a shared native ID exists, earlier native items are ignored and later items merge by ID. This preserves attachments without guessing correspondence from message content or storing a second history.

Normal sessions use native identity only. This migration adds no host state, database fields, or protocol parser. Old rollout parsing and content matching are removed.

## Limitations

Compaction may remove the original turn boundary. In that case the old checkpoint remains authoritative for the compacted history. A partially saved legacy turn cannot recover missing earlier assistant items safely. Native items after an identity anchor can be recovered normally. These limits apply only to checkpoints written before stable native identity was used.

## Removal

Remove the migration when legacy checkpoints are no longer supported. Retain the native identity merger and attachment preservation. No database migration is needed.
