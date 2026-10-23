---
name: create-ticket
description: "Create a planner ticket or bug report. Use when asked to make changes unrelated to an existing ticket, to create a new ticket, or to report a bug."
metadata:
  version: 0.0.7
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

Before saving a new ticket that adds or changes UI, read `pst pstdio-planner refinement-policy`. When `updateCanvasDesign` is enabled, follow the project's canvas skill and update the relevant live design first. Preserve existing previews and add named variations when comparing alternatives. Link the canvas page, exact preview names, source paths, and a short walkthrough in the ticket. Canvas designs replace artifact prototypes. If Canvas is unavailable, use the project's existing design workflow and record why no canvas was linked. Do not install extensions automatically. If the option is off, record why the design step was skipped. Resolve policy-read failures before finishing.

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
9. Save the ticket, then ask for review as described in [Review requests](#review-requests).
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
2. Set `blocked_reason: "Not reproduced"` in the frontmatter, then save. Auto-build does not start blocked tickets.
3. Create a review request that asks for the missing details, as shown below.
4. After the person answers, try again. When the bug reproduces, set `blocked_reason: ""`, complete the report, and save.

## Review requests

Do not write open questions, assumptions, or risks in the ticket. Put them in one Planner review request, so the person answers them in a form. Skip the request when nothing needs an answer.

Use one question per item:

- A choice only the person can make: a required single-choice question. Put your recommended option first and end its label with "(recommended)".
- Missing information: a text question that names exactly what you need.
- Always add one optional text question for other notes.

The form shows every option as its own radio button or checkbox, so each option label must make sense alone. Keep each label to one short sentence. Write `--instructions` as a Markdown list with one item per line, and put any context the person needs there. Ask at most five questions.

For a bug you could not reproduce:

```bash
pst pstdio-planner request-human --ticket PS-12 \
  --title "Help reproduce the bug" \
  --instructions "- I followed the reported steps on main (commit abc1234) in the desktop app on macOS.
- The export finished without an error." \
  --request '{"kind":"decision","questions":[
    {"id":"steps","label":"What did you do right before the error?","required":true,"input":{"kind":"text"}},
    {"id":"environment","label":"Which app version and operating system?","required":false,"input":{"kind":"text"}},
    {"id":"proof","label":"Paste the error text or the log lines","required":false,"input":{"kind":"text"}},
    {"id":"notes","label":"Other notes","required":false,"input":{"kind":"text"}}]}'
```

For a bug fix that needs a trade-off decision:

```bash
pst pstdio-planner request-human --ticket PS-12 \
  --title "Choose the fix" \
  --instructions "- **A** removes the cause but changes the storage format.
- **B** is a temporary workaround. See files/adr.md." \
  --request '{"kind":"decision","questions":[
    {"id":"fix","label":"Which fix should we build?","required":true,"input":{"kind":"single-choice","options":[
      {"id":"a","label":"A. Fix the storage format (recommended)"},
      {"id":"b","label":"B. Retry on failure (temporary)"}]}},
    {"id":"notes","label":"Other notes","required":false,"input":{"kind":"text"}}]}'
```

When the person answers, read the answers with `pst pstdio-planner review-requests read --request-id <request-id>`. Update the ticket so it states what was decided. Do not copy the answers into the ticket; the request keeps them. Never answer your own request.

## Example

```bash
pst tickets write --title "Finish uploads when the connection drops briefly"
# Apply a template if needed, then edit its returned absolute path.
pst tickets save --id PS-42
```

## Reference

Use `depends_on` for real code prerequisites. If a ticket consumes a file or API another ticket introduces, link that ticket before launching work. Independent prerequisites can run in parallel; Planner combines their submitted revisions when a child needs both. Do not mark prerequisites Done or add dependency-only blocker text just to control launch order. With review blocking off, children can build on submitted revisions while the prerequisites remain in review.

Pass a ticket shorthand such as `PS-42` to `--id`. The command resolves it to the stored ticket.

See [how attempts use dependencies](https://prompt.studio/docs/extensions/planner/attempts/#dependencies) and the [Planner CLI](https://prompt.studio/docs/extensions/planner/cli/).
