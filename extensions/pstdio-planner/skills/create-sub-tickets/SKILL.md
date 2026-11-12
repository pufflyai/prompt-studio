---
name: create-sub-tickets
description: "Break a parent ticket into actionable sub-tickets. Use when asked to create child or sub-tickets for a ticket."
metadata:
  version: 0.0.5
---

Sub-tickets are planner tickets linked to a parent. Create them like any ticket (see create-ticket) with `--parent` set.

## Workflow

1. Identify the parent ticket. Pass its shorthand, such as `PS-12`, to `--id` or `--parent`.
2. Read it with `pst tickets panel --id <parent>`. Pull it with `pst tickets pull --id <parent>` and read relevant linked architecture, contracts, schemas, research, and design files. Preserve the proposed behavior and technical decisions when splitting the work into sub-tickets that are:
   - Small enough to implement in one sitting.
   - Independently testable.
   - Limited to one system. Split work that crosses systems or has a large scope.
3. Create each sub-ticket with `pst tickets write --title "<title>" --parent <parent-shorthand>`.
4. Fill `.pstdio/extension-storage/pstdio.planner/tickets/<shorthand>/ticket.md`, using the absolute `path` the command returns. Follow the `create-ticket` standard. Name the files or modules involved, the validation commands, assumptions, and `depends_on`. Link the relevant parent design and identify which flows, contracts, schema choices, and compatibility requirements each child implements. Add actionable coding tasks at this stage, without silently changing the design or hiding unresolved choices.
5. Apply a template when it helps. List templates with `pst tickets templates`, then run `pst tickets apply-template --id <shorthand> --template <template>`. Priority and type belong in tags from `pst tags list`, not in body sections.
6. Check unfinished tickets with `pst tickets list`. If a child needs another ticket to finish first, add that ticket to the child's `depends_on`. Do not set a Blocked status or a blocked reason only because the child is waiting; Planner derives readiness from `depends_on`. See [Dependencies](https://prompt.studio/docs/extensions/planner/cli/#dependencies).
7. Save each child with `pst tickets save --id <shorthand>`.
8. Stop after saving the sub-tickets. Do not implement them or edit unrelated tickets.

## Example

```bash
pst tickets write --title "Add upload retry config schema" --parent PS-12
pst tickets save --id PS-43
```

## Reference

`pst tickets list --parent PS-12` lists a ticket's children. See the [Planner CLI](https://prompt.studio/docs/extensions/planner/cli/) and [how attempts use dependencies](https://prompt.studio/docs/extensions/planner/attempts/#dependencies).

## Decision requests

Create a review request only for a genuine unresolved decision that the existing instructions and your authority cannot settle. Do not ask for routine assumptions, blanket risk acceptance, handoff acknowledgement, missing credentials, access, resources, reproduction details, or a non-decision action.

For an independent non-decision blocker, discover the configured Blocked status with `pst statuses list`, then use `pst tickets update --id <ticket> --status <blocked-status> --blocked-reason "<what is missing and what allows work to continue>"`. Clear the reason when resolved and resume the appropriate status. Keep dependency waiting in `depends_on`, without an independent blocked reason.

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
