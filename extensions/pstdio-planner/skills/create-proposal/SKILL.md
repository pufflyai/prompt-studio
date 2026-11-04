---
name: create-proposal
description: "Create a proposal ticket. Use for new features, large refactors, breaking API or schema changes, architecture changes, security changes, or when the user asks to save a plan as a proposal. Do not use for bug fixes, wording-only changes, non-breaking dependency updates, configuration changes, or tests for existing behavior."
metadata:
  version: 0.0.6
---

A proposal is a Planner ticket built from the `proposal` template. Use the `pst tickets` commands to create and edit it. See [Edit a ticket as a local file](https://prompt.studio/docs/extensions/planner/cli/#edit-a-ticket-as-a-local-file).

A proposal ticket is not a document in the user's repository. If the repository keeps its own PRDs or ADRs, read and link them, and add a new one there only when the user asks. Prompt Studio's own product requirements describe Prompt Studio, not the user's product.

A proposal lets a person check quickly that your plan matches their vision. It says what changes for users and why, through concrete scenarios. It does not say how to build it. Implementation planning happens later, in the tickets created from the proposal.

## UI designs

Before saving a proposal that adds or changes UI, read `pst pstdio-planner refinement-policy`. When `updateCanvasDesign` is enabled, follow the project's canvas skill and update the relevant live design first. Preserve existing previews and name alternatives clearly. Link the canvas page, exact preview names, source paths, and a short walkthrough in the ticket. Canvas designs replace artifact prototypes. If Canvas is unavailable, use the project's existing design workflow and record why no canvas was linked. Do not install extensions automatically. If the option is off, record why the design step was skipped. Resolve policy-read failures before finishing.

## Workflow

1. Derive a short, verb-led title from the request, such as `add-`, `update-`, `remove-`, `refactor-`, or `fix-`.
2. Confirm the `proposal` template exists with `pst tickets templates`.
3. Run `pst tickets write --title "<title>"`. This returns the absolute `path` of the draft in the default project folder. Edit that file.
4. Run `pst tickets apply-template --id <shorthand> --template proposal` to apply the template.
5. Read the relevant code and the repository's documentation. The proposal must match how the product works today.
6. Fill in the template. Keep it short:
   - Write scenarios a person can picture: a concrete state, an action, and a visible outcome. Use the template's `### Scenario:` heading and Given/When/Then quote for each one.
   - Put at most five scenarios in `ticket.md`. Put the rest in `files/scenarios.md`.
   - Remove the template's HTML comments.
   - Do not add implementation steps, code paths, or open questions to `ticket.md`.
7. Create supporting files only as described below.
8. Run `pst tickets save --id <shorthand>`.
9. Create a review request only for a genuine unresolved decision, as described below.

## Ticket files

Put planning material in `.pstdio/extension-storage/pstdio.pstdio-planner/tickets/<shorthand>/files/<name>`. The next `pst tickets save` attaches the file to the ticket. Put implementation, test, validation, and review evidence in reports instead; see [Reports](https://prompt.studio/docs/extensions/reports/#write-a-report).

Add a file only when the person needs it to judge the proposal:

| File                       | Create when                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| `scenarios.md`             | There are more than five scenarios.                                                            |
| `research.md`              | The proposal depends on findings a reviewer must check, such as current behavior or prior art. |
| `adr.md`                   | The proposal makes a lasting architecture decision or chooses between real trade-offs.         |
| `architecture-overview.md` | The proposal changes which part of the system owns what.                                       |

Contracts, schemas, and cookbooks belong to the implementation tickets, not the proposal.

## Review request

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

## Finish condition

Stop after saving the proposal and creating any needed review request. Do not implement it. If the proposal depends on other tickets, list them in `depends_on`; see [Dependencies](https://prompt.studio/docs/extensions/planner/cli/#dependencies).
