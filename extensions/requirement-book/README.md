# Requirement book

A working local prototype for PS-104. The sole requirement authority is `documentation/requirement-book/book.json` in Git.

```sh
pst extensions add /absolute/path/to/extensions/requirement-book --force
pst pstdio.requirement-book workspace select --workspace-id <workspace-id>
pst pstdio.requirement-book open
```

Choose a workspace in the dashboard. The reading view uses a compact file tree, a narrow rule header and bulleted acceptance conditions. Level and intent status remain in the canonical data without reading badges. Core identities use `RB`; extension identities use `RBE`. Chapter navigation shows titles. The native Findings and Suggestions rows use separate count badges.

Use the Requirement book ▾ menu to create a rule, chapter or finding. Categorical fields use single-select dropdowns. Author ADD, AMEND, MOVE and REMOVE suggestions with exact before/after comparisons. Stale targets require reconciliation. Applying writes only to a writable working branch; it does not commit, create a PR, merge or accept intent. Removed references stay retired; same-group movement preserves identity.

Rules, chapters, findings and suggestions have independently searchable resource kinds, icons and pages. Book/chapter/rule breadcrumbs follow selection. In-chapter selection replaces the current viewer; dropdowns mount on demand and the rule tree virtualizes visible rows.

Evidence collection, observations, source inspectors and automatic evidence checks are outside this prototype. Existing historical evidence records are unused. Project records hold findings, suggestions, drafts and read markers, without another authoritative book. Cancel and Escape retain authoring drafts; explicit discard clears them.

People and agents use the same public commands. `read --query` searches intent, `get --reference` retrieves one rule, and `read --revision accepted` reads the configured target branch. `book validate` and `book import` support complete-book changes with schema, reference, retired-identity and target-digest checks. Import refuses surviving legacy requirement authorities.

The populated working migration remains subject to repository review; the accepted branch changes only after merge. This extension is installed locally and is not in the default catalog.
