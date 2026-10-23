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
9. Ask for review as described below.

## Ticket files

Put planning material in `.pstdio/extension-storage/pstdio-planner/tickets/<shorthand>/files/<name>`. The next `pst tickets save` attaches the file to the ticket. Put implementation, test, validation, and review evidence in reports instead; see [Reports](https://prompt.studio/docs/extensions/reports/#write-a-report).

Add a file only when the person needs it to judge the proposal:

| File                       | Create when                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| `scenarios.md`             | There are more than five scenarios.                                                            |
| `research.md`              | The proposal depends on findings a reviewer must check, such as current behavior or prior art. |
| `adr.md`                   | The proposal makes a lasting architecture decision or chooses between real trade-offs.         |
| `architecture-overview.md` | The proposal changes which part of the system owns what.                                       |

Contracts, schemas, and cookbooks belong to the implementation tickets, not the proposal.

## Review request

Do not write assumptions, risks, or open questions in the ticket. Put them in one Planner review request, so the person answers them in a form. Skip the request when nothing needs an answer.

```bash
pst pstdio-planner request-human --ticket PS-12 \
  --title "Review the proposal" \
  --instructions "- **D1.** Mounted background tabs use memory. A cap keeps memory bounded.
- **C1.** Resizing a panel on one workspace resizes it on every workspace of the same page type.
- **R1.** Every user's tab layout resets once when the layout cache is discarded." \
  --request '{"kind":"decision","questions":[
    {"id":"d1-tab-cap","label":"D1. Cap mounted background tabs?","required":true,"input":{"kind":"single-choice","options":[
      {"id":"cap-5","label":"Cap at 5, unmount the oldest (recommended)"},
      {"id":"no-cap","label":"No cap"}]}},
    {"id":"confirm","label":"Tick each assumption you accept","required":false,"input":{"kind":"multiple-choice","options":[
      {"id":"c1-shared-sizes","label":"C1. Panel sizes are shared by page type"}]}},
    {"id":"risks","label":"Tick each risk you accept","required":false,"input":{"kind":"multiple-choice","options":[
      {"id":"r1-layout-reset","label":"R1. Tab layouts reset once for every user"}]}},
    {"id":"notes","label":"Corrections or other answers","required":false,"input":{"kind":"text"}}]}'
```

Use these question types:

- **Decide** (`D1`, `D2`, ...): a choice only the person can make. Use a required single-choice question. Put your recommended option first and end its label with "(recommended)".
- **Confirm** (`C1`, `C2`, ...): an assumption you made. List them as options of one multiple-choice question. An option the person leaves unticked needs a correction.
- **Risk** (`R1`, `R2`, ...): a cost or danger the person should accept. List them as options of one multiple-choice question.
- **Notes**: always add one optional text question for corrections and answers outside the given options.

The form shows every option as its own radio button or checkbox, so each option label must make sense alone. Keep each label to one short sentence. Write `--instructions` as a Markdown list with one item per line, using the same IDs, and put any context the person needs there. Ask at most seven items in total. If you have more, the proposal is too large; split it.

When the person answers:

1. Read the answers with `pst pstdio-planner review-requests read --request-id <request-id>`.
2. Update the proposal so it states the decided behavior. Do not copy the answers into the ticket; the request keeps them.
3. If an answer raises a new question, create a new request for it. Answered requests do not change.

Never answer your own request.

## Finish condition

Stop after saving the proposal and creating any needed review request. Do not implement it. If the proposal depends on other tickets, list them in `depends_on`; see [Dependencies](https://prompt.studio/docs/extensions/planner/cli/#dependencies).
