---
name: create-ticket
description: "Create a planner ticket. Use when asked to make changes unrelated to an existing ticket or when asked to create a new ticket."
metadata:
  version: 0.0.6
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

## Workflow

1. List the available statuses, tags, and ticket templates with `pst statuses list`, `pst tags list`, and `pst tickets templates`. Do not assume their names. Use `pst tickets list` to check for related work. See [Tags and statuses](https://prompt.studio/docs/extensions/planner/tags-and-statuses/).
2. Choose how to create the ticket.
   - For a detailed body, run `pst tickets write --title "<title>" [--status <status>] [--tags <tag>]`. Apply a template with `pst tickets apply-template --id <shorthand> --template <template>`, edit the returned absolute `path` in the default project folder, then save it with `pst tickets save --id <shorthand>`. See [Edit a ticket as a local file](https://prompt.studio/docs/extensions/planner/cli/#edit-a-ticket-as-a-local-file).
   - If the complete body already exists, run `pst tickets create --content "<markdown>" [--status <status>] [--tags <tag>]`. The first heading becomes the title.
3. Read the relevant code and documentation before writing the body. Use the repository's own documentation, such as its PRDs, ADRs, and contributor rules: they describe the product you are changing. Prompt Studio's documentation describes the tool that tracks the work; do not treat its product requirements as this repository's requirements unless the repository is Prompt Studio itself. Mark unanswered questions with `[MISSING INFORMATION]`.
4. Complete every applicable template section. A free-form ticket must still include:
   - References, or a note that no useful documentation exists.
   - The work in scope and the checks or tests that will prove it works.
   - The real files or modules involved, plus assumptions and gaps.
   - Required documentation changes, or `None`.
   - `depends_on` in the frontmatter. List the tickets that supply required code or other prerequisites. Planner checks their current attempts and Git integration before starting dependent work.
5. Put priority and type in tags from `pst tags list`. Repeat `--tags` when needed.
6. Check unfinished tickets with `pst tickets list`. If another ticket must finish first, add it to `depends_on`. Keep dependency waiting in those links; do not copy it into `blocked_reason` or change the ticket to Blocked for that reason alone. Planner derives readiness from the current prerequisites; see [Dependencies](https://prompt.studio/docs/extensions/planner/cli/#dependencies). Use `--blocked-reason "<why>"` only for an independent blocker, such as missing credentials. Clear that text with `pst tickets update --id <shorthand> --blocked-reason ''` when the independent blocker is resolved; keep the dependency links.
7. Before saving, read the title alone. If it does not say what gets better, rewrite it.
8. Stop after saving the ticket unless the user also asked for implementation. In that case, follow the `implement-ticket` skill.

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
