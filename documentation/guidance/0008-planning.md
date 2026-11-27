# Planning and documentation

## 1. Language

1. Use simple technical English in plans, explanations, documentation, tickets, comments, and messages.
2. Write short, direct sentences.
3. Use plain words instead of jargon.
4. Explain technical terms readers may not know.

## 2. Documentation

1. Keep central documentation in `documentation/`. Start with the [documentation guide](../guides/0001-documentation.md).
2. Use `guidance/` for shared rules, `guides/` for setup and workflows, `references/` for APIs and architecture, `requirement-book/book.json` for canonical product requirements, `adrs/` for decisions, and `lessons-learned/` for recurring failures.
3. Group related documents in topic folders such as `references/architecture/`, `references/sdk/`, `guides/development/`, and `requirements/dashboard/`. Do not repeat the folder topic in every filename.
4. Use `NNNN-kebab-case.md`. Number independently within each folder, preserve assigned numbers, and use the next available number. Do not reuse removed ADR or lesson numbers.
5. Keep product requirements in the canonical book. Preserve stable references; keep proposed intent distinct from accepted intent. Do not create parallel PRD authorities.
6. Update links and check claims against current source when changing documentation.

## 3. Architecture decisions

1. Before coding a workaround forced by an external limit, create an ADR in `documentation/adrs/` with the next four-digit number and a kebab-case filename.
2. Put `Proposed: YYYY-MM-DD` and `Status: ...` below every ADR title. Preserve the proposal date when the decision changes; if unknown, use the earliest Git addition date. State whether the decision is proposed, accepted, superseded, or removed. Keep any implementation or qualification caveats.
3. Temporary-workaround filenames must contain `-temporary-`, including superseded records. Their titles must include “Temporary”.
4. Every temporary-workaround ADR needs a `## Removal` section and either `## Limitations` or `## External limitation`.
5. Describe the ideal design, the external limit preventing it, and why a clean solution is currently impossible.
6. Describe the chosen workaround, its trade-offs, how it stays isolated, and when and how it will be removed.
7. Clearly identify the design as a temporary workaround rather than the intended system.
8. Keep ADRs short. Preserve the decision, why it was chosen, consequences, and evidence needed to understand it.
9. Merge superseded records about the same decision into the current ADR. Carry forward active constraints, important failed approaches, and any remaining limitations or removal conditions.
10. Delete obsolete workarounds with no lasting value. Put reusable failure findings in lessons learned.
11. Preserve the surviving ADR's number and original proposal date. Note which records it absorbs; never reuse retired numbers.
12. Update incoming links and heading references. Keep an old-path pointer only when known external links need it.
13. Keep distinct active decisions separate. A proposed book entry does not establish that its design shipped.
14. Give each ADR a unique number above the highest number used, including retired records. Resolve collisions with new numbers, preserve proposal dates, and update references. Documentation validation rejects duplicate ADR numbers.

## 4. Tickets and extension scope

1. Manage tickets with the `pst` CLI.
2. After editing a ticket, save it with `pst pstdio.planner save-ticket --id PS-XXX`.
3. Use `pst --help` for command help.
4. When asked to edit extensions, do not update templates in `packages/pstdio/files`.

## 5. Rule references

1. Reference product requirements by stable `RB chapter.section.id` (Core) or `RBE chapter.section.id` (Extensions) identities. Guidance procedure references keep `NNN.S.R`: document, section and rule number. Historical guidance references map to the canonical book through its migration ledger.
2. Start rule numbering at 1 in each section.

## 6. Lessons learned

1. Keep a lesson only when its failure mechanism can recur in supported development. A fixed incident can still teach a relevant lesson.
2. Use short sections and bullets: when to use, failure, prevention, and evidence. Link current source or focused tests; remove ticket metadata, long timelines, and outdated instructions.
3. Merge overlapping lessons. Put rules already covered by guidance or references in those documents, preserving useful causes and limitations.
4. Preserve surviving numbers, never reuse removed numbers, and update incoming links when merging or removing lessons.

## 7. Review handoff comments

Post the handoff in the ticket’s Activity. When using the CLI, publish an entry with `kind: "comment"` to the ticket through `pst resources activity publish`. Reserve Planner review requests for unresolved decisions that need an answer.

Use these three lines in order. Keep the comment to 80 words, excluding evidence links.

1. **Action** — Ask for one concrete next step. Name the person or team when known.
2. **Status** — State what is ready and what still blocks progress. Call out failed or blocked checks that affect the handoff.
3. **Evidence** — Link the relevant PR, report, or CI run. Keep full revisions, test logs, and failure details in those sources.

Before posting, read the action and status on their own. The recipient should know what to do and why without opening a link.

### Example release handoff

**Action** — Publish the SDK from #2522 through the normal release process.

**Status** — The SDK passed independent review. Extension PR #2487 needs the release to update its dependency and lockfile, then rerun failed and blocked checks. Candidate checks passed. Published-dependency checks still fail, and other packaged failures need triage.

**Evidence** — [SDK PR #2522](https://github.com/pufflyai/prompt-studio/pull/2522), [extensions PR #2487](https://github.com/pufflyai/prompt-studio/pull/2487), RP-888, and independent review RP-895.
