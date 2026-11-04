---
name: create-sub-tickets
description: "Break a parent ticket into actionable sub-tickets. Use when asked to create child or sub-tickets for a ticket."
metadata:
  version: 0.0.4
---

Sub-tickets are planner tickets linked to a parent. Create them like any ticket (see create-ticket) with `--parent` set.

## Workflow

1. Identify the parent ticket. Pass its shorthand, such as `PS-12`, to `--id` or `--parent`.
2. Read it with `pst tickets panel --id <parent>`. Split the work into sub-tickets that are:
   - Small enough to implement in one sitting.
   - Independently testable.
   - Limited to one system. Split work that crosses systems or has a large scope.
3. Create each sub-ticket with `pst tickets write --title "<title>" --parent <parent-shorthand>`.
4. Fill `.pstdio/extension-storage/pstdio.pstdio-planner/tickets/<shorthand>/ticket.md`, using the absolute `path` the command returns. Follow the `create-ticket` standard. Name the files or modules involved, the validation commands, assumptions, and `depends_on`.
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

A decision must stand alone without logs or conversation history. Include the ticket identity and brief **Problem**, **Solutions**, and **Downsides** in plain language. Explain each choice and its cost, and clearly mark the recommended choice. Use a required choice question for the decision; optional notes are useful when they help explain the choice. Do not add confirmation or risk checklists that contain no decision.

```bash
pst pstdio-planner request-human --ticket PS-12 \
  --title "PS-12 · Choose the release scope" \
  --instructions "**Problem:** People need to try the new export before a wider release.

**Solutions:** Release to the internal project first (recommended), or release to everyone now.

**Downsides:** The internal release delays wider access. Releasing to everyone exposes more people to faults." \
  --request '{"kind":"decision","questions":[{"id":"scope","label":"Who should receive the export?","required":true,"input":{"kind":"single-choice","options":[{"id":"internal","label":"Internal project first (recommended)"},{"id":"everyone","label":"Everyone now"}]}}]}'
```

Read saved answers with `pst pstdio-planner review-requests read --request-id <request-id>` before continuing. Never answer your own request.
