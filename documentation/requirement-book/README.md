# Requirement book

[book.json](book.json) is the sole product-requirement authority for this repository revision. Read **RB1 — Mission and product boundaries** before making product decisions. The [migration ledger](migration.md) maps former PRDs and guidance sections to stable RB identities without repeating their requirements.

Open Requirement book in Prompt Studio LOCAL. Select WS-94 and Working branch to inspect this migration. Accepted intent reads the target branch; it will contain the book only after repository review and merge. Different Git revisions are review states, not independently editable authorities.

Each rule has a stable reference, chapter, L0–L3 detail level, scope, statement, status, governing/related references and acceptance conditions. `accepted` describes governing intent in this revision; it does not mean implemented, released or verified. `proposed` retains unaccepted plans and source-derived candidates. Do not silently promote these while importing them.

People and agents use the same public commands:

```sh
pst pstdio.requirement-book read --query "Mission and product boundaries"
pst pstdio.requirement-book get --reference 'RB 1.A.3'
pst pstdio.requirement-book read --revision accepted
```

The underlying JSON can be read directly without a running extension. Edit it once on a working branch; validate schema and references before preparing a PR. Keep procedures in guidance and guides, API usage in references, and decision rationale in ADRs. Link those documents to governing RB entries instead of copying policy back into them.

Use the native Requirement book ▾ menu to create a rule, chapter, finding or observation. Rules, chapters, findings, observations and suggestions are independently searchable resources with distinct icons. Rule suggestions expose ADD, AMEND, MOVE and REMOVE changes. Apply writes only to a working workspace; it does not commit, merge or accept the change.

Observations identify source revision, kind, conditions and limits. Reading a test file is source evidence, not a passed test. Findings record demonstrated violations, potential conflicts, missing evidence or stale evidence. Resolved findings and mapped observations remain reachable through their resource pages. Review state and drafts live in extension storage; they do not duplicate accepted intent.

For bulk imports, put a complete authored book under `.pstdio/extension-storage/pstdio.requirement-book/imports/`, run `book validate --path imports/<name>.json`, then `book import --path imports/<name>.json --workspace-id <id> --expected-digest <digest>`. Import checks the whole book and target revision, rejects surviving legacy requirement authorities, and preserves the accepted branch.

The initial audit is source-based. See the saved PS-104 project-book report for findings, evidence and limits. No provider authentication, production performance qualification or full Cloud recovery acceptance is inferred from the population work.
