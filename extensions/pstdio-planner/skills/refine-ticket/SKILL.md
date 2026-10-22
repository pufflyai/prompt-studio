---
name: refine-ticket
description: "Provide additional information to a ticket by researching the codebase and documentation, and/or format a ticket given a template. Use when asked to refine, improve, expand, or format an existing ticket."
metadata:
  version: 0.0.5
---

Refine a Planner ticket by adding researched detail and applying a template when useful.

## Workflow

1. Identify the ticket. Pass its shorthand, such as `PS-12`, to `--id`.
2. Run `pst tickets pull --id <shorthand>`. This writes `.pstdio/extension-storage/pstdio-planner/tickets/<shorthand>/ticket.md`. Without `--force`, it preserves existing local edits. Read the current body before changing it. See [Edit a ticket as a local file](https://prompt.studio/docs/extensions/planner/cli/#edit-a-ticket-as-a-local-file).
3. If the user requested a template, confirm it exists with `pst tickets templates`, then run `pst tickets apply-template --id <shorthand> --template <template>`. Keep useful existing content and remove placeholders that do not apply.
4. Research the code and the repository's own documentation, such as its PRDs, ADRs, and contributor rules. Prompt Studio's product requirements are not this repository's requirements unless the repository is Prompt Studio. Keep the ticket short, and remove text that does not help a reader decide or implement. Add the missing detail for the kind of ticket:
   - Proposal: concrete scenarios and the reason for the change, as the `create-proposal` skill describes. Do not add implementation steps.
   - Bug: reproduction, proof, cause, and fix, as the Bug reports section of the `create-ticket` skill describes. Do not refine a bug that is not reproduced; ask for the missing details instead.
   - Other tickets: scope, the real files or modules to touch, and the tests that prove the work.
   - `depends_on` in frontmatter for tickets that must finish first. Do not express waiting with a Blocked status. See [Dependencies](https://prompt.studio/docs/extensions/planner/cli/#dependencies). Priority and type stay in tags.
5. Read the project workflow options with `pst pstdio-planner refinement-policy`. See [Refinement options](https://prompt.studio/docs/extensions/planner/#refinement-options). People can toggle **Generate an artifact prototype for UX features** in the Project Planner extension settings. Check `pst --help` for the `pstdio-artifacts` commands. For a new feature with UX changes, when `generateArtifactPrototype` is enabled and Artifacts is installed and enabled for this project:
   - Create an interactive HTML prototype of the proposed user flow with the publish-artifact skill. Use sample data and cover the main interactions and relevant empty or error states.
   - Publish it with `pst pstdio-artifacts publish --file_path <file> --label "UX prototype"` and add the returned dashboard URL and a short walkthrough to the ticket. See [Publish a page](https://prompt.studio/docs/extensions/artifacts/#publish-a-page).
   - Update an existing ticket prototype with its saved `--url` so its revision history stays together.
   - Do not finish refinement or mark the proposal ready until the prototype is published and linked.
     If the option is off or Artifacts is unavailable, record the reason in the ticket. Do not install it automatically. If the policy cannot be read, resolve or report the failure before completing refinement. Tickets without a new UX feature do not require a prototype.
6. Save the ticket with `pst tickets save --id <shorthand>`.
7. Put open questions, assumptions, and risks in a review request, not in the ticket. Follow the Review request section of the `create-proposal` skill for proposals and the Review requests section of the `create-ticket` skill for other tickets. First list open requests with `pst pstdio-planner review-requests list --ticket <shorthand> --open-only`. Cancel an open request only when refinement made it wrong, and do not ask the same question twice.
8. Mark a proposal ready for review with `pst tickets proposal-refined --id <shorthand>`.
9. Stop after refinement. Do not implement code unless the user asked for it.

## Status

Refinement does not change ticket status. Run `pst tickets update --status` only when the user asks for a status change.
