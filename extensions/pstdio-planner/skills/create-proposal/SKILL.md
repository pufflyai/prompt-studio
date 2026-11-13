---
name: create-proposal
description: "Create a proposal ticket. Use for new features, large refactors, breaking API or schema changes, architecture changes, security changes, or when the user asks to save a plan as a proposal. Do not use for bug fixes, wording-only changes, non-breaking dependency updates, configuration changes, or tests for existing behavior."
metadata:
  version: 0.0.7
---

A proposal is a Planner ticket built from the `proposal` template. Use the `pst pstdio.pstdio-planner` commands to create and edit it. See [Edit a ticket as a local file](https://prompt.studio/docs/extensions/planner/cli/#edit-a-ticket-as-a-local-file).

A proposal ticket is not a document in the user's repository. If the repository keeps its own PRDs or ADRs, read and link them, and add a new one there only when the user asks. Prompt Studio's own product requirements describe Prompt Studio, not the user's product.

A proposal lets a person judge the outcome and the technical approach before implementation. Explain what changes for users, why, and how it works, through concrete scenarios and a brief mechanism. Include API shapes, schemas, and design choices when they need review. Coding tasks and exhaustive implementation instructions belong to later tickets.

## UI designs

Before saving a proposal that adds or changes UI, read `pst pstdio.pstdio-planner refinement-policy`. When `updateCanvasDesign` is enabled, follow the project's canvas skill and update the relevant live design first. Preserve existing previews and name alternatives clearly. Link the canvas page, exact preview names, source paths, and a short walkthrough in the ticket. Canvas designs replace artifact prototypes. If Canvas is unavailable, use the project's existing design workflow and record why no canvas was linked. Do not install extensions automatically. If the option is off, record why the design step was skipped. Resolve policy-read failures before finishing.

## Workflow

1. Derive a short, verb-led title from the request, such as `add-`, `update-`, `remove-`, `refactor-`, or `fix-`.
2. Confirm the `proposal` template exists with `pst pstdio.pstdio-planner list-ticket-templates`.
3. Run `pst pstdio.pstdio-planner write-ticket --title "<title>"`. This returns the absolute `path` of the draft in the default project folder. Edit that file.
4. Run `pst pstdio.pstdio-planner apply-ticket-template --id <shorthand> --template proposal` to apply the template.
5. Read the relevant code and the repository's documentation. The proposal must match how the product works today.
6. Fill in the template. Keep it short:
   - Use concise bullets for the outcome, Why, and How. How explains the mechanism and main component or workflow changes, rather than repeating the goal.
   - Include optional Downsides when concrete costs, limitations, or trade-offs help the decision. Omit empty sections and generic risk lists.
   - Write scenarios a person can picture: a concrete state, an action, and a visible outcome. Use the template's `### Scenario:` heading and Given/When/Then quote for each one.
   - Put at most five scenarios in `ticket.md`. Put the rest in `files/scenarios.md`.
   - Remove the template's HTML comments.
   - Keep coding steps and detailed source references in later implementation tickets or supporting files, respectively. Keep material assumptions and unresolved choices visible beside the affected design; request a decision only when it needs the person's authority.
7. Create supporting files only as described below.
8. Run `pst pstdio.pstdio-planner save-ticket --id <shorthand>`.
9. Create a review request only for a genuine unresolved decision, as described below.

## Ticket files

Put planning material in `.pstdio/extension-storage/pstdio.pstdio-planner/tickets/<shorthand>/files/<name>`. The next `pst pstdio.pstdio-planner save-ticket` attaches the file to the ticket. Put implementation, test, validation, and review evidence in reports instead; see [Reports](https://prompt.studio/docs/extensions/reports/#write-a-report).

Add a file only when the person needs it to judge the proposal:

| File                       | Create when                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| `scenarios.md`             | There are more than five scenarios.                                                            |
| `research.md`              | The proposal depends on findings a reviewer must check, such as current behavior or prior art. |
| `adr.md`                   | The proposal makes a lasting architecture decision or chooses between real trade-offs.         |
| `architecture-overview.md` | The proposal introduces a subsystem or changes structure, interactions, ownership, or lifecycle. |
| `contracts.md`             | API, SDK, CLI, event, or other interface shapes need review before implementation.              |
| `schemas.md`               | Stored data, configuration, or message shapes need review before implementation.                |

Keep a simple proposal in one readable ticket. Put a small example inline when enough; create a supporting file when the design needs separate review. Link every supporting file from the ticket with a relative link such as `files/contracts.md`.

### Technical supporting material

- Use concise bullets in architecture and research explanations, with tables, diagrams, and compact examples where useful. Distinguish inspected current behavior, proposed choices, and unverified assumptions. Keep source links beside the claims they support.
- For substantial design changes, read the `architecture-overview` document template. For interface or data decisions, read `contracts` or `schemas` as needed. Use `research` when findings need checking. Adapt the relevant sections and omit those that do not help review.
- Resolve document templates through Planner's template provider, which preserves project overrides and disabled templates. Its extension commands are `pstdio.pstdio-planner.command.templates.list` with `{ "type": "document" }` and `pstdio.pstdio-planner.command.templates.read` with `{ "name": "architecture-overview" }` (or another name). Execute them through the [extension command API](https://prompt.studio/docs/references/extensions/command-and-process-api/). These commands do not expose a CLI route; do not invent `pst templates read`. If the template or command interface is unavailable, write from the quality criteria here without replacing project customizations.
- An architecture overview names real modules and marks new components as proposed. Explain the concrete execution path: inputs, outputs, interactions, state ownership, and lifecycle. Cover failure handling, compatibility, and trade-offs when they affect the decision.
- Include meaningful Mermaid diagrams for substantial architecture changes. Show current and proposed relationships with labeled interactions; use sequence or state diagrams when ordering or lifecycle matters. Check syntax and agreement with the text. A list of responsibilities alone is not an architecture explanation.
- Show consequential API and schema choices with request/response, interface, event, or data examples. Explain constraints, errors, compatibility, and migration implications where relevant. Put fuller shapes in `contracts.md` or `schemas.md` when needed; include all fields and relationships needed to judge the design. Proposals are where these designs get reviewed. Leave implementation cookbooks and coding tasks to later tickets.

## Review request

Create a review request only for a genuine unresolved decision that the existing instructions and your authority cannot settle. Do not ask for routine assumptions, blanket risk acceptance, handoff acknowledgement, missing credentials, access, resources, reproduction details, or a non-decision action.

For an independent non-decision blocker, discover the configured Blocked status with `pst pstdio.pstdio-planner ticket-status read`, then use `pst pstdio.pstdio-planner update-ticket --id <ticket> --status <blocked-status> --blocked-reason "<what is missing and what allows work to continue>"`. Clear the reason when resolved and resume the appropriate status. Keep dependency waiting in `depends_on`, without an independent blocked reason.

Keep request text to at most 80 words, excluding document links. Identify the ticket in the title. Prefer **Problem**, **Solution**, and **Downside**, with one short sentence per part; use another structure when it makes the decision clearer. State the decision, mark the recommended choice, and name the main cost of each option. Keep question and option labels short; do not repeat the summary in them. Use a required choice question; add optional notes only when useful. Do not add confirmation or risk checklists that contain no decision.

Use descriptive Markdown links to relevant documents or exact sections, such as the proposal, ADR, design, or report. Include as many relevant links as needed. Reuse existing documents and link supporting evidence, background, and implementation detail instead of copying them into the request. Keep the choice and essential trade-offs visible without opening the links.

This example assumes the ticket has an attached `files/release-plan.md` and no agreed first-release audience.

```bash
pst pstdio.pstdio-planner request-review --ticket PS-12 \
  --title "PS-12 · Choose the first release audience" \
  --instructions "**Problem:** The export is ready, but its first release audience is undecided.

**Solution:** Release to the internal project first (recommended), or to everyone now.

**Downside:** An internal release delays wider access; releasing to everyone exposes more people to faults.

**Details:** [Release plan](files/release-plan.md)." \
  --request '{"kind":"decision","questions":[{"id":"audience","label":"Who should receive the first release?","required":true,"input":{"kind":"single-choice","options":[{"id":"internal","label":"Internal project first (recommended)"},{"id":"everyone","label":"Everyone now"}]}}]}'
```

Read saved answers with `pst pstdio.pstdio-planner review-requests read --request-id <request-id>` before continuing. Never answer your own request.

## Finish condition

Stop after saving the proposal and creating any needed review request. Do not implement it. If the proposal depends on other tickets, list them in `depends_on`; see [Dependencies](https://prompt.studio/docs/extensions/planner/cli/#dependencies).
