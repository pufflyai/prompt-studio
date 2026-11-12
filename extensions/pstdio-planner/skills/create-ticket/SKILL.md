---
name: create-ticket
description: "Create a planner ticket or bug report. Use when asked to make changes unrelated to an existing ticket, to create a new ticket, or to report a bug."
metadata:
  version: 0.0.8
---

Manage Planner tickets with the `pst tickets` commands.

## Titles

Name what gets better for the person, not the code change. Someone should understand the title without reading the ticket.

- Use plain words. Put code, component names, and steps in the body. Keep a technical name only when people choose it, such as Docker.
- For a bug, name what works again.
- Keep a title the user gave you.

| Instead of | Write |
| --- | --- |
| Add retry to upload client | Finish uploads when the connection drops briefly |
| Add revocable consumer grants to browser previews | Choose who can see previews |

## UI designs

Before saving a new ticket that adds or changes UI, read `pst pstdio.planner refinement-policy`. When `updateCanvasDesign` is enabled, follow the project's canvas skill and update the relevant live design first. Preserve existing previews and add named variations when comparing alternatives. Link the canvas page, exact preview names, source paths, and a short walkthrough in the ticket. Complete the canvas skill's source handoff before saving: record where the implementation workspace finds the reviewed design sources, either a proposal folder merged to the default branch or, in Git projects, a pushed branch and commit SHA. Canvas designs replace artifact prototypes. If Canvas is unavailable, use the project's existing design workflow and record why no canvas was linked. Do not install extensions automatically. If the option is off, record why the design step was skipped. Resolve policy-read failures before finishing.

## Workflow

1. List the available statuses, tags, and ticket templates with `pst statuses list`, `pst tags list`, and `pst tickets templates`. Do not assume their names. Use `pst tickets list` to check for related work. See [Tags and statuses](https://prompt.studio/docs/extensions/planner/tags-and-statuses/).
2. Choose how to create the ticket.
   - For a detailed body, run `pst tickets write --title "<title>" [--status <status>] [--tags <tag>]`. Apply a template with `pst tickets apply-template --id <shorthand> --template <template>`, edit the returned absolute `path` in the default project folder, then save it with `pst tickets save --id <shorthand>`. See [Edit a ticket as a local file](https://prompt.studio/docs/extensions/planner/cli/#edit-a-ticket-as-a-local-file).
   - If the complete body already exists, run `pst tickets create --content "<markdown>" [--status <status>] [--tags <tag>]`. The first heading becomes the title.
   - For a bug, use the `bug-fix` template and follow [Bug reports](#bug-reports).
3. Read the relevant code and documentation before writing the body. Use the repository's own documentation, such as its PRDs, ADRs, and contributor rules: they describe the product you are changing. Prompt Studio's documentation describes the tool that tracks the work; do not treat its product requirements as this repository's requirements unless the repository is Prompt Studio itself.
4. Fill in every template section that applies. Keep the ticket short and specific. Remove the template's HTML comments. A free-form ticket must still state:
   - The work in scope and out of scope.
   - The real files or modules involved.
   - The tests or checks that will prove it works, and the documentation to update, or `None`.
5. Set `depends_on` in the frontmatter. List tickets that supply required code or other prerequisites. Planner checks their current attempts and Git integration before starting dependent work.
6. Put priority and type in tags from `pst tags list`. Repeat `--tags` when needed.
7. Check unfinished tickets with `pst tickets list`. Keep dependency waiting in `depends_on`; do not copy it into `blocked_reason` or change the ticket to Blocked for that reason alone. Planner derives readiness from the current prerequisites; see [Dependencies](https://prompt.studio/docs/extensions/planner/cli/#dependencies). Use `--blocked-reason "<why>"` only for an independent blocker, such as missing credentials. Clear that text with `pst tickets update --id <shorthand> --blocked-reason ''` when the independent blocker is resolved; keep the dependency links.
8. Before saving, read the title alone. If it does not say what gets better, rewrite it.
9. Save the ticket. Create a review request only for a genuine unresolved decision, as described in [Review requests](#review-requests).
10. Stop after saving the ticket unless the user also asked for implementation. In that case, follow the `implement-ticket` skill.

## Bug reports

A bug report is only useful when someone can see the bug happen. Reproduce it before you write anything else.

1. Reproduce the bug as a user would, from a clean state. Use the app, the CLI, Playwright, or a failing test.
2. Write the exact steps, the expected result, and the actual result. Copy error text exactly.
3. Add proof under **Proof**: error output, log lines, failing test output, or a screenshot. A failing test is the strongest proof. Save screenshots (PNG, JPEG, GIF, WebP, or SVG) and long logs in the ticket's `files/` and name them under **Proof**. `pst tickets save` stores images as ticket attachments, and `pst tickets pull` writes them back.
4. Find the cause. Label it **Confirmed** only when you traced it in the code or proved it with a test. Otherwise label it **Hypothesis**.
5. Propose a fix. Compare it with at least one alternative in the table, and state what each option costs.
6. If the proposed fix works around the cause instead of removing it, write `files/adr.md`. Mark it as a temporary workaround. Explain how the system should work, what prevents that today, the trade-offs of the workaround, and when it will be removed.
7. Name the regression test that fails today and will pass after the fix.

When you cannot reproduce the bug:

1. Set **Reproduced** to `No`. Under **Reproduction**, write what you tried and what happened. Leave Cause and Fix empty. Do not guess a fix.
2. Set the configured Blocked status and a specific `blocked_reason` naming the missing reproduction details and what allows work to continue, then save.
3. Record the missing details in the blocked reason. Do not create a review request just to obtain them.
4. After the person answers, try again. When the bug reproduces, set `blocked_reason: ""`, complete the report, and save.

## Review requests

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
