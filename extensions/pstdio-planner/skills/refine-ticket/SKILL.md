---
name: refine-ticket
description: "Provide additional information to a ticket by researching the codebase and documentation, and/or format a ticket given a template. Use when asked to refine, improve, expand, or format an existing ticket."
metadata:
  version: 0.0.7
---

Refine a Planner ticket by adding researched detail and applying a template when useful.

## Workflow

1. Identify the ticket. Pass its shorthand, such as `PS-12`, to `--id`.
2. Run `pst pstdio.planner pull-ticket --id <shorthand>`. This writes `.pstdio/extension-storage/pstdio.planner/tickets/<shorthand>/ticket.md`. Without `--force`, it preserves existing local edits. Read the current body and relevant linked files, including architecture, contracts, schemas, and research, before changing it. See [Edit a ticket as a local file](https://prompt.studio/docs/extensions/planner/cli/#edit-a-ticket-as-a-local-file).
3. If the user requested a template, confirm it exists with `pst pstdio.planner list-ticket-templates`, then run `pst pstdio.planner apply-ticket-template --id <shorthand> --template <template>`. Keep useful existing content and remove placeholders that do not apply.
4. Research the code and the repository's own documentation, such as its PRDs, ADRs, and contributor rules. Prompt Studio's product requirements are not this repository's requirements unless the repository is Prompt Studio. Keep the ticket short, and remove text that does not help a reader decide or implement. Add the missing detail for the kind of ticket:
   - Proposal: concise bullets for the outcome, Why, and a brief How, concrete scenarios, and optional Downsides, as the `create-proposal` skill describes. Preserve useful technical design, API shapes, schemas, diagrams, and source references. Update affected explanations, diagrams, and assumptions together when the design changes; correct unsupported claims. Keep material uncertainty visible. Do not replace the design with an outcome summary or add coding tasks.
   - Bug: reproduction, proof, cause, and fix, as the Bug reports section of the `create-ticket` skill describes. For an unreproduced bug, record the missing reproduction details with the configured Blocked status and a specific blocked reason; do not create a request just to collect them.
   - Other tickets: scope, the real files or modules to touch, and the tests that prove the work.
   - `depends_on` in frontmatter for tickets that must finish first. Do not express waiting with a Blocked status. See [Dependencies](https://prompt.studio/docs/extensions/planner/cli/#dependencies). Priority and type stay in tags.
5. Read the project workflow options with `pst pstdio.planner refinement-policy`. People can toggle **Update canvas designs for UI changes** in Project Planner settings. For tickets that add or change UI, when `updateCanvasDesign` is enabled:
   - Follow the project’s canvas skill. Update the relevant live canvas design before completing refinement or changing production UI. Reuse existing canvases and preserve unrelated designs. Use safe sample data and cover the proposed interactions and relevant empty or error states.
   - Add the canvas page link, exact preview names, source paths, and a short walkthrough to the ticket. For alternatives, preserve the original and give each variation a distinct name.
   - Complete the canvas skill's source handoff before finishing refinement. Record where a new implementation workspace finds the reviewed design source: a proposal folder merged to the default branch, or for Git projects a pushed branch and commit SHA. A page link alone does not carry uncommitted changes.
   - Do not publish an artifact prototype for this requirement. The canvas design replaces that step.
   - Do not finish refinement or mark a proposal ready until the canvas is updated and linked. If Canvas is unavailable, use the project's existing design workflow and record why no canvas was linked. Do not install extensions automatically.
   If the option is off, record why the design step was skipped. If the policy cannot be read, resolve or report the failure before completing refinement. Tickets without UI changes do not require a canvas update.
6. Save the ticket with `pst pstdio.planner save-ticket --id <shorthand>`.
7. Create a review request only for a genuine unresolved decision. Follow the brief summary and document links format below. Use Blocked and a specific blocked reason for missing resources, credentials, access, or reproduction details. Do not request routine assumptions, risk checklists, or non-decision actions. First list open requests with `pst pstdio.planner review-requests list --ticket <shorthand> --open-only`. Cancel an open request only when refinement made it wrong, and do not ask the same question twice.
8. Mark a proposal ready for review with `pst pstdio.planner proposal-refined --id <shorthand>`.
9. Stop after refinement. Do not implement code unless the user asked for it.

## Status

For an independent non-decision blocker, use the configured Blocked status and a specific blocked reason as described below. Clear the reason and resume the appropriate status when resolved. Otherwise refinement changes ticket status only when the user requests it.

## Critical UI verification

Require browser or visual checks only for critical risks: a blocked primary task, hidden essential content or controls, broken keyboard/focus behavior, preview isolation, or a critical regression. Use the smallest representative scenario. Add screenshot comparisons only when appearance is the critical contract and behavioral assertions cannot establish it. Routine copy, spacing, cosmetic, and documentation changes do not require browser runs or screenshots. Explicit user-requested visual verification still applies. Keep Canvas examples for exploration. A visual example does not require a matching automated test. Name the critical risk covered by any new browser check. Ordinary relevant unit, type, and build checks still apply.

## Decision requests

Create a review request only for a genuine unresolved decision that the existing instructions and your authority cannot settle. Do not ask for routine assumptions, blanket risk acceptance, handoff acknowledgement, missing credentials, access, resources, reproduction details, or a non-decision action.

For an independent non-decision blocker, discover the configured Blocked status with `pst pstdio.planner ticket-status read`, then use `pst pstdio.planner update-ticket --id <ticket> --status <blocked-status> --blocked-reason "<what is missing and what allows work to continue>"`. Clear the reason when resolved and resume the appropriate status. Keep dependency waiting in `depends_on`, without an independent blocked reason.

Keep request text to at most 80 words, excluding document links. Identify the ticket in the title. Prefer **Problem**, **Solution**, and **Downside**, with one short sentence per part; use another structure when it makes the decision clearer. State the decision, mark the recommended choice, and name the main cost of each option. Keep question and option labels short; do not repeat the summary in them. Use a required choice question; add optional notes only when useful. Do not add confirmation or risk checklists that contain no decision.

Use descriptive Markdown links to relevant documents or exact sections, such as the proposal, ADR, design, or report. Include as many relevant links as needed. Reuse existing documents and link supporting evidence, background, and implementation detail instead of copying them into the request. Keep the choice and essential trade-offs visible without opening the links.

This example assumes the ticket has an attached `files/release-plan.md` and no agreed first-release audience.

```bash
pst pstdio.planner request-review --ticket PS-12 \
  --title "PS-12 · Choose the first release audience" \
  --instructions "**Problem:** The export is ready, but its first release audience is undecided.

**Solution:** Release to the internal project first (recommended), or to everyone now.

**Downside:** An internal release delays wider access; releasing to everyone exposes more people to faults.

**Details:** [Release plan](files/release-plan.md)." \
  --request '{"kind":"decision","questions":[{"id":"audience","label":"Who should receive the first release?","required":true,"input":{"kind":"single-choice","options":[{"id":"internal","label":"Internal project first (recommended)"},{"id":"everyone","label":"Everyone now"}]}}]}'
```

Read saved answers with `pst pstdio.planner review-requests read --request-id <request-id>` before continuing. Never answer your own request.
